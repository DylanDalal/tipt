// src/EditProfile.jsx
import './SignupWizard.css';                  // ← reuse styling
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db, storage } from './firebase';
import {
  doc, getDoc, setDoc, arrayUnion, serverTimestamp,
} from 'firebase/firestore';
import {
  ref, uploadBytesResumable, getDownloadURL,
} from 'firebase/storage';
import debounce from 'lodash.debounce';

// static options
const SUBSCRIPTION_OPTIONS = ['monthly', 'yearly'];
const GENRE_OPTIONS = [
  'Rock','Pop','Hip-Hop','Jazz','Country','Electronic','Classical',
];

// validation schema (same as wizard, minus email/pw)
const schema = yup.object({
  firstName: yup.string().required(),
  lastName:  yup.string().required(),
  altName:   yup.string().required(),
  phone:     yup.string().matches(/^\+?\d{10,15}$/,'10–15 digits').required(),
  street:    yup.string().required(),
  city:      yup.string().required(),
  state:     yup.string().required(),
  postalCode:yup.string().matches(/^\d{5}(-\d{4})?$/,'ZIP invalid').required(),
  subscription: yup.string().oneOf(SUBSCRIPTION_OPTIONS).required(),
  acceptsApplePay: yup.boolean(),
  acceptsGooglePay:yup.boolean(),
  acceptsSamsungPay:yup.boolean(),
  taxID: yup.string().when(
    ['acceptsApplePay','acceptsGooglePay','acceptsSamsungPay'],
    { is:(a,g,s)=>a||g||s, then:s=>s.required('Tax ID required') }
  ),
}).required();

export default function EditProfile() {
  const { uid } = useParams();
  const nav     = useNavigate();

  // local state
  const [uploadPct, setUploadPct] = useState({});
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [addrQ, setAddrQ] = useState('');
  const [addrHits, setAddrHits] = useState([]);
  const [status, setStatus] = useState('');

  // form
  const { register, setValue, handleSubmit, watch, trigger,
          formState:{errors,isSubmitting} } =
    useForm({ resolver:yupResolver(schema) });

  /*──────────────── fetch current doc ────────────────*/
  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db,'recipients',uid));
      if (!snap.exists()) { nav('/'); return; }
      const d = snap.data();
      // hydrate form
      Object.entries(d).forEach(([k,v])=> setValue(k,v));
      setAddrQ([d.street,d.city,d.state].filter(Boolean).join(', '));
    })();
  }, [uid,nav,setValue]);

  /*──────────────── address autocomplete ─────────────*/
  const queryAddr = useCallback(
    debounce(async q=>{
      if(!q.trim()){ setAddrHits([]); return; }
      const url=`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
      try{
        const r = await fetch(url,{headers:{'User-Agent':'tipt-edit/1.0'}});
        setAddrHits(r.ok?await r.json():[]);
      }catch{ setAddrHits([]); }
    },200),[]
  );
  const chooseHit = h=>{
    const a=h.address??{};
    setValue('street',[a.house_number,a.road].filter(Boolean).join(' '));
    setValue('city',a.city||a.town||a.village||'');
    setValue('state',a.state||'');
    setValue('postalCode',a.postcode||'');
    setAddrQ(h.display_name); setAddrHits([]);
  };

  /*──────────────── uploads (same helper) ────────────*/
  const uploadFile = (file,path,field)=>{
    if(!file||file.size>5*1024*1024)
      return setStatus('Max file size 5 MB');
    const task = uploadBytesResumable(
      ref(storage,`recipients/${uid}/${path}`),file);
    task.on('state_changed',
      s=>setUploadPct(p=>({...p,[path]:
        Math.round(s.bytesTransferred/s.totalBytes*100)})),
      err=>setStatus(err.message),
      async ()=>{
        const url = await getDownloadURL(task.snapshot.ref);
        await setDoc(
          doc(db,'recipients',uid),
          { [field]:field==='images'?arrayUnion(url):url },
          { merge:true });
        setValue(field,field==='images'
          ? [ ...(watch('images')||[]), url ]
          : url);
      });
  };

  /*──────────────── save ─────────────────────────────*/
  const onSubmit = async vals=>{
    await setDoc(
      doc(db,'recipients',uid),
      { ...vals, updatedAt:serverTimestamp() },
      { merge:true });
    nav(`/profile/${uid}`);
  };

  /*──────────────── render ───────────────────────────*/
  const hasPay = watch(['acceptsApplePay','acceptsGooglePay','acceptsSamsungPay']).some(Boolean);

  return (
    <div id="wizard">
      <form onSubmit={handleSubmit(onSubmit)}>
        <h3>Edit Profile</h3>

        {/* IDENTITY */}
        <div className="row cols-3">
          <div><label>First name*</label><input {...register('firstName')} /></div>
          <div><label>Last name*</label><input {...register('lastName')} /></div>
          <div><label>Alt / Stage name*</label><input {...register('altName')} /></div>
        </div>

        {/* PHONE + PLAN */}
        <div className="row cols-2">
          <div><label>Phone*</label><input type="tel" {...register('phone')} /></div>
          <div>
            <label>Subscription*</label>
            <select {...register('subscription')} defaultValue="">
              <option value="" disabled hidden>Select a plan…</option>
              {SUBSCRIPTION_OPTIONS.map(p=>(
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ADDRESS + SEARCH */}
        <div className="row">
          <label style={{width:'100%',position:'relative'}}>
            Address search
            <input
              value={addrQ}
              onChange={e=>{ setAddrQ(e.target.value); queryAddr(e.target.value);} }
              placeholder="123 Main St, City…"/>
            {addrHits.length>0&&(
              <ul className="addr-dropdown">
                {addrHits.map(h=>(
                  <li key={h.place_id} onClick={()=>chooseHit(h)}>
                    {h.display_name}
                  </li>
                ))}
              </ul>
            )}
          </label>
        </div>

        <div className="row cols-4">
          <div><label>Street*</label><input {...register('street')} /></div>
          <div><label>City*</label><input {...register('city')} /></div>
          <div><label>State*</label><input {...register('state')} /></div>
          <div><label>Postal code*</label><input {...register('postalCode')} /></div>
        </div>

        {/* PAY PLATFORMS */}
        {[
          ['acceptsApplePay','Apple Pay'],
          ['acceptsGooglePay','Google Pay'],
          ['acceptsSamsungPay','Samsung Pay'],
        ].map(([k,l])=>(
          <label key={k} style={{display:'block'}}>
            <input type="checkbox" {...register(k)} /> {l}
          </label>
        ))}
        {hasPay&&(
          <div className="row"><div>
            <label>Tax ID*</label><input {...register('taxID')} />
          </div></div>
        )}

        {/* IMAGES */}
        <div className="row cols-2">
          <div>
            <p className="mt-0 mb-0">Profile image (≤5 MB)</p>
            <input type="file" accept="image/*"
              onChange={e=>uploadFile(e.target.files[0],'profile.jpg','profileImageUrl')}/>
            {uploadPct['profile.jpg']&&<progress value={uploadPct['profile.jpg']} max={100}/>}
          </div>
          <div>
            <p className="mt-0 mb-0">Banner image (≤5 MB)</p>
            <input type="file" accept="image/*"
              onChange={e=>uploadFile(e.target.files[0],'banner.jpg','profileBannerUrl')}/>
            {uploadPct['banner.jpg']&&<progress value={uploadPct['banner.jpg']} max={100}/>}
          </div>
        </div>

        {/* DESCRIPTION */}
        <textarea placeholder="Description" {...register('description')} />

        {/* TAGS & GENRES */}
        <div className="row cols-2">
          <div>
            <label>Tags</label>
            <select multiple {...register('tags')}>
              {/* ideally fetch tag list like wizard; omit for brevity */}
            </select>
          </div>
          <div>
            <label>Genres</label>
            <select multiple {...register('genres')}>
              {GENRE_OPTIONS.map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* LINKS */}
        <div className="row cols-2">
          <div className="flex-half">
            <input placeholder="PayPal.me username" {...register('paypalMeUser')} />
          </div>
          <div className="flex-half">
            <input placeholder="Venmo username" {...register('venmoUsername')} />
          </div>
        </div>
        <div className="row cols-2">
          <div className="flex-half">
            <input placeholder="Cash App tag" {...register('cashAppTag')} />
          </div>
          <div className="flex-half">
            <input placeholder="Spotify URL" {...register('spotifyUrl')} />
          </div>
        </div>
        <div className="row cols-2">
          <div className="flex-half">
            <input placeholder="YouTube URL" {...register('youTubeUrl')} />
          </div>
          <div className="flex-half">
            <input placeholder="TikTok URL" {...register('tikTokUrl')} />
          </div>
        </div>

        {/* THEME / GALLERY */}
        <div className="row cols-2">
          <div>
            <label className="mt-0">Theme Color</label>
            <input type="color" {...register('themeColor')} style={{width:100}} />
          </div>
          <div>
            <input multiple type="file" accept="image/*"
              onChange={e=>setGalleryFiles(Array.from(e.target.files))}/>
            {galleryFiles.map((f,i)=>{
              const path=`gallery/${Date.now()}_${i}_${f.name}`;
              return (
                <div key={path}>
                  {f.name}{' '}
                  <button type="button"
                    onClick={()=>uploadFile(f,path,'images')}>Upload</button>
                  {uploadPct[path]&&<progress value={uploadPct[path]} max={100}/>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ERRORS + ACTIONS */}
        {!!Object.keys(errors).length && (
          <ul className="error-list">
            {Object.values(errors).map((e,i)=><li key={i}>{e.message}</li>)}
          </ul>
        )}

        <div className="nav-buttons">
          <button type="button" className="secondary" onClick={()=>nav(-1)}>Cancel</button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting?'Saving…':'Save Changes'}
          </button>
        </div>

        {status && <p style={{color:'crimson'}}>{status}</p>}
      </form>
    </div>
  );
}
