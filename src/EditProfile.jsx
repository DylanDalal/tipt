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
import { extractDominantColors } from './colorExtractor';

// Function to extract YouTube video ID from various URL formats
const extractYouTubeVideoId = (url) => {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtu\.be\/([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
};

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
  const [isUploading, setIsUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');

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
    
    setIsUploading(true);
    const task = uploadBytesResumable(
      ref(storage,`recipients/${uid}/${path}`),file);
    task.on('state_changed',
      s=>setUploadPct(p=>({...p,[path]:
        Math.round(s.bytesTransferred/s.totalBytes*100)})),
      err=>{
        setStatus(err.message);
        setIsUploading(false);
      },
      async ()=>{
        const url = await getDownloadURL(task.snapshot.ref);
        
        // Extract colors if this is a banner image
        let bannerColors = [];
        if (field === 'profileBannerUrl') {
          try {
            console.log('EditProfile: Extracting colors from banner image...');
            bannerColors = await extractDominantColors(file);
            console.log('EditProfile: Extracted colors:', bannerColors);
          } catch (error) {
            console.error('Error extracting colors:', error);
            // Continue without colors if extraction fails
          }
        }

        // Save to database
        const updateData = { [field]: field === 'images' ? arrayUnion(url) : url };
        if (field === 'profileBannerUrl' && bannerColors.length > 0) {
          updateData.bannerColors = bannerColors;
          console.log('EditProfile: Saving banner colors to database:', bannerColors);
        }

        console.log('EditProfile: Saving to database:', updateData);

        await setDoc(
          doc(db,'recipients',uid),
          updateData,
          { merge:true });
        
        // Small delay to ensure the update is processed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setValue(field,field==='images'
          ? [ ...(watch('images')||[]), url ]
          : url);
        
        setIsUploading(false);
      });
  };

  /*──────────────── save ─────────────────────────────*/
  const onSubmit = async vals=>{
    console.log('EditProfile: onSubmit called with values:', vals);
    
    // Get current document to preserve banner colors
    try {
      const currentDoc = await getDoc(doc(db, 'recipients', uid));
      const currentData = currentDoc.exists() ? currentDoc.data() : {};
      console.log('EditProfile: Current document data:', currentData);
      
      // Preserve banner colors if they exist
      const updateData = { ...vals, updatedAt: serverTimestamp() };
      if (currentData.bannerColors) {
        updateData.bannerColors = currentData.bannerColors;
        console.log('EditProfile: Preserving banner colors:', currentData.bannerColors);
      }
      
      console.log('EditProfile: Final update data:', updateData);
      await setDoc(
        doc(db,'recipients',uid),
        updateData,
        { merge:true });
    } catch (error) {
      console.error('EditProfile: Error in onSubmit:', error);
      // Fallback to original behavior
      await setDoc(
        doc(db,'recipients',uid),
        { ...vals, updatedAt:serverTimestamp() },
        { merge:true });
    }
    
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
            <input placeholder="PayPal.Me username" {...register('payPalUrl')} />
          </div>
          <div className="flex-half">
            <input placeholder="Venmo username" {...register('venmoUrl')} />
          </div>
        </div>
        <div className="row cols-2">
          <div className="flex-half">
            <input placeholder="Cash App $cashtag" {...register('cashAppTag')} />
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
        <div className="row cols-2">
          <div className="flex-half">
            <input placeholder="Twitter URL" {...register('twitterUrl')} />
          </div>
          <div className="flex-half">
            <input placeholder="Facebook URL" {...register('facebookUrl')} />
          </div>
        </div>
        <div className="row cols-2">
          <div className="flex-half">
            <input placeholder="Instagram URL" {...register('instagramUrl')} />
          </div>
          <div className="flex-half">
            {/* Empty div for layout balance */}
          </div>
        </div>

        {/* YouTube Videos */}
        <div className="row">
          <div style={{ width: '100%' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a8a8a5', fontSize: '14px' }}>
              YouTube Videos
            </label>
            <input
              placeholder="YouTube video URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID)"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              style={{ width: '100%', marginBottom: '0.5rem' }}
            />
            <button
              type="button"
              onClick={async () => {
                if (videoUrl && videoUrl.trim()) {
                  const videoId = extractYouTubeVideoId(videoUrl);
                  if (videoId) {
                    // Verify the video exists
                    try {
                      const response = await fetch(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, {
                        method: 'HEAD'
                      });
                      if (response.ok) {
                        const currentVideos = watch('videos') || [];
                        setValue('videos', [...currentVideos, { url: videoUrl, id: videoId }]);
                        setVideoUrl('');
                        setStatus('');
                      } else {
                        setStatus('Video not found. Please check the URL and try again.');
                      }
                    } catch (error) {
                      setStatus('Error verifying video. Please check your internet connection and try again.');
                    }
                  } else {
                    setStatus('Invalid YouTube URL. Please enter a valid YouTube video URL.');
                  }
                }
              }}
              style={{
                background: '#ea8151',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Add Video
            </button>
            
            {/* Display added videos */}
            {(watch('videos') || []).length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#a8a8a5', fontSize: '14px' }}>Added Videos:</h4>
                {(watch('videos') || []).map((video, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    padding: '0.5rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px'
                  }}>
                    <img
                      src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                      alt="Video thumbnail"
                      style={{
                        width: '60px',
                        height: '45px',
                        borderRadius: '4px',
                        objectFit: 'cover'
                      }}
                    />
                    <span style={{ flex: 1, fontSize: '12px', color: '#d0d0d0' }}>
                      {video.url}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const currentVideos = watch('videos') || [];
                        setValue('videos', currentVideos.filter((_, i) => i !== index));
                      }}
                      style={{
                        background: '#ff4444',
                        color: 'white',
                        border: 'none',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
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
          <button type="button" className="secondary" onClick={()=>nav(-1)} disabled={isUploading}>Cancel</button>
          <button type="submit" disabled={isSubmitting || isUploading}>
            {isSubmitting ? 'Saving…' : isUploading ? 'Uploading…' : 'Save Changes'}
          </button>
        </div>

        {status && <p style={{color:'crimson'}}>{status}</p>}
      </form>
    </div>
  );
}
