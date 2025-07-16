/* SignupWizard.jsx */
import './SignupWizard.css';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  signUpWithEmail,
  signInWithEmail,
} from './auth';
import { onAuthStateChanged } from 'firebase/auth';
import {
  arrayUnion,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import debounce from 'lodash.debounce';

const SUBSCRIPTION_OPTIONS = ['monthly', 'yearly'];
const GENRE_OPTIONS = [
  'Rock', 'Pop', 'Hip-Hop', 'Jazz', 'Country', 'Electronic', 'Classical',
];
const FRESH = {
  email: '', password: '',
  firstName: '', lastName: '', altName: '',
  phone: '', street: '', city: '', state: '', postalCode: '',
  subscription: '',
  acceptsApplePay: false, acceptsGooglePay: false, acceptsSamsungPay: false,
  taxID: '',
  profileImageUrl: '', profileBannerUrl: '',
  description: '', notes: '',
  tags: [], genres: [], themeColor: '#008080',
  images: [],
  payPalUrl: '', venmoUrl: '', spotifyUrl: '',
  youTubeUrl: '', tikTokUrl: '',
};

const schema = yup.object({
  firstName: yup.string().required('First name required'),
  lastName:  yup.string().required('Last name required'),
  altName:   yup.string().required('Alt / stage name required'),
  phone: yup.string().matches(/^\+?\d{10,15}$/, 'Phone: 10-15 digits').required(),
  street: yup.string().required('Street required'),
  city: yup.string().required('City required'),
  state: yup.string().required('State required'),
  postalCode: yup.string()
    .matches(/^\d{5}(-\d{4})?$/, 'ZIP must be 5 digits').required(),
  subscription: yup.string()
    .oneOf(SUBSCRIPTION_OPTIONS, 'Pick a plan').required(),
  acceptsApplePay: yup.boolean(),
  acceptsGooglePay: yup.boolean(),
  acceptsSamsungPay: yup.boolean(),
  taxID: yup.string().when(
    ['acceptsApplePay', 'acceptsGooglePay', 'acceptsSamsungPay'],
    {
      is: (a, g, s) => a || g || s,
      then: s => s.required('Tax ID required for Pay platforms'),
      otherwise: s => s.notRequired(),
    }),
}).required();

/* ─────────── component ─────────── */
export default function SignupWizard() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState(FRESH);
  const [status, setStatus] = useState('');
  const [tagOptions, setTagOptions] = useState([]);
  const [uploadPct, setUploadPct] = useState({});
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const [addrQ, setAddrQ]   = useState('');
  const [addrHits, setAddrHits] = useState([]);

  // forward-geocode (debounced)
  const queryAddr = useCallback(
    debounce(async q => {
      if (!q.trim()) { setAddrHits([]); return; }

      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;

      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'tipt-wizard/1.0' } });
        setAddrHits(r.ok ? await r.json() : []);
      } catch { setAddrHits([]); }
    }, 200),
    [],
  );

  const chooseHit = hit => {
    const a = hit.address ?? {};
    setValue('street',     [a.house_number, a.road].filter(Boolean).join(' '), { shouldValidate: true });
    setValue('city',       a.city || a.town || a.village || '',               { shouldValidate: true });
    setValue('state',      a.state || '',                                     { shouldValidate: true });
    setValue('postalCode', a.postcode || '',                                  { shouldValidate: true });
    setAddrQ(hit.display_name);
    setAddrHits([]);
  };

  useEffect(() => {
  const unsub = onAuthStateChanged(auth, user => {
    if (user) {
      getDocs(collection(db, 'tags')).then(snap =>
        setTagOptions(snap.docs.map(d => d.id)));
    }
  });
  return unsub;
}, []);

  /* RHF */
  const {
    register, setValue, watch, trigger, getValues,
    formState: { errors, isValid },
  } = useForm({
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: data,
    resolver: yupResolver(schema),
  });
  
  const hasPayPlatform = watch([
    'acceptsApplePay', 'acceptsGooglePay', 'acceptsSamsungPay',
  ]).some(Boolean);

  const waitForAuthReady = () =>
    new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, user => {
        if (user) {
          unsub();
          resolve(user);
        }
      });
    });

  /* Firebase auth (Step-1) */
  const registerAccount = async e => {
    e.preventDefault();
    try {
      let cred;
      try {
        cred = await signUpWithEmail(data.email, data.password);
        const user = await waitForAuthReady(); // ← ensures Firestore sees request.auth
        await setDoc(
          doc(db, 'recipients', user.uid),
          {
            ownerUid: user.uid,
            recipientId: uuidv4(),
            createdAt: serverTimestamp(),
          }
        );
        setStep(2);
      } catch (signupError) {
        // Try to sign in existing user
        try {
          cred = await signInWithEmail(data.email, data.password);
          // Check if user has completed profile
          const userDoc = await getDoc(doc(db, 'recipients', cred.user.uid));
          if (userDoc.exists() && userDoc.data().completed) {
            // Existing user with completed profile - go to profile
            nav(`/profile/${cred.user.uid}`);
          } else {
            // Existing user but incomplete profile - continue wizard
            setStep(2);
          }
        } catch (signinError) {
          setStatus('Invalid email or password');
        }
      }
    } catch (err) { 
      setStatus(err.message); 
    }
  };


  /* uploads */
  const uploadFile = (file, path, field) => {
    if (!file || file.size > 5 * 1024 * 1024)
      return setStatus('Max file size 5 MB');
    const task = uploadBytesResumable(
      ref(storage, `recipients/${auth.currentUser.uid}/${path}`),
      file,
    );
    task.on('state_changed',
      s => setUploadPct(p => ({ ...p, [path]: Math.round(s.bytesTransferred / s.totalBytes * 100) })),
      err => setStatus(err.message),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);

        setData(p =>
          ({ ...p, [field]: field === 'images' ? [...p.images, url] : url })
        );

        await setDoc(
          doc(db, 'recipients', auth.currentUser.uid),
          { [field]: field === 'images' ? arrayUnion(url) : url },
          { merge: true }
        );
      }
    );
  };

  /* Finish */
  // persist URL so finish() can’t overwrite
  const finish = async () => {
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== '')
    );
    await setDoc(
      doc(db, 'recipients', auth.currentUser.uid),
      { ...clean, completed: true, completedAt: serverTimestamp() },
      { merge: true }
    );
    nav(`/profile/${auth.currentUser.uid}`);
  };


  const tryNext = async () => {
    const ok = await trigger();
    if (ok) {
      setData(p => ({ ...p, ...getValues() }));
      setShowErrors(false);
      setStep(3);
    } else {
      setShowErrors(true);
    }
  };

  return (
    <div id="wizard">
      {/* STEP-1 ───────────────────── */}
      {step === 1 && (
        <form onSubmit={registerAccount}>
          <h3>Step 1 – Account</h3>
          <div className="row cols-2">
            <div>
              <label>Email *</label>
              <input
                required
                type="email"
                value={data.email}
                onChange={e => setData(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <label>Password *</label>
              <input
                required
                type="password"
                value={data.password}
                onChange={e => setData(p => ({ ...p, password: e.target.value }))}
              />
            </div>
          </div>

          <div className="nav-buttons">
            <button type="submit">Continue</button>
          </div>
        </form>
      )}

      {/* STEP-2 ───────────────────── */}
      {step === 2 && (
        <form onSubmit={e => e.preventDefault()}>
          <h3>Step 2 – Required Info</h3>

          {/* Names */}
          {/* 3 items across */}
          <div className="row cols-3">
            <div>
              <label>First name *</label>
              <input {...register('firstName')} />
            </div>
            <div>
              <label>Last name *</label>
              <input {...register('lastName')} />
            </div>
            <div>
              <label>Alt / Stage name *</label>
              <input {...register('altName')} />
            </div>
          </div>

          {/* 2 items across */}
          <div className="row cols-2">
            <div>
              <label>Phone *</label>
              <input type="tel" {...register('phone')} />
            </div>
            <div>
              <label>Subscription *</label>
              <select {...register('subscription')} defaultValue="">
                <option value="" disabled hidden>Select a plan…</option>
                {SUBSCRIPTION_OPTIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

            </div>
          </div>

          {/* 4 items across */}
          <div className="row">
            <label style={{ width: '100%', position: 'relative' }}>
              Address search
              <input
                value={addrQ}
                onChange={e => {
                  setAddrQ(e.target.value);
                  queryAddr(e.target.value);
                }}
                placeholder="123 Main St, City…"
              />
              {addrHits.length > 0 && (
                <ul className="addr-dropdown">
                  {addrHits.map(h => (
                    <li key={h.place_id} onClick={() => chooseHit(h)}>
                      {h.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </label>
          </div>

          <div className="row cols-4">
            <div>
              <label>Street *</label>
              <input {...register('street')} />
            </div>
            <div>
              <label>City *</label>
              <input {...register('city')} />
            </div>
            <div>
              <label>State *</label>
              <input {...register('state')} />
            </div>
            <div>
              <label>Postal code *</label>
              <input {...register('postalCode')} />
            </div>
          </div>

          {/* Pay platforms */}
          {[
            ['acceptsApplePay', 'Apple Pay'],
            ['acceptsGooglePay', 'Google Pay'],
            ['acceptsSamsungPay', 'Samsung Pay'],
          ].map(([k, label]) => (
            <label key={k} style={{ display: 'block' }}>
              <input type="checkbox" {...register(k)} /> {label}
            </label>
          ))}

          {hasPayPlatform && (
            <div className="row cols">
              <div>
                <label>Tax ID *</label>
                <input {...register('taxID')} />
              </div>
            </div>
          )}

          {/* Images */}
          <div className="row cols-2">
            <div>
              <p className="mt-0 mb-0">Profile image (≤ 5 MB)</p>
              <input
                type="file"
                accept="image/*"
                onChange={e => uploadFile(e.target.files[0], 'profile.jpg', 'profileImageUrl')}
              />
              {uploadPct['profile.jpg']
                && <progress value={uploadPct['profile.jpg']} max={100} />}
            </div>
            <div>
              <p className="mt-0 mb-0">Banner image (≤ 5 MB)</p>
              <input
                type="file"
                accept="image/*"
                onChange={e => uploadFile(e.target.files[0], 'banner.jpg', 'profileBannerUrl')}
              />
              {uploadPct['banner.jpg']
                && <progress value={uploadPct['banner.jpg']} max={100} />}
            </div>
          </div>

          {/* Nav */}
          <div className="nav-buttons">
            <button type="button" className="secondary" onClick={() => setStep(1)}>Back</button>
            <button
              type="button"
              onClick={tryNext}
              style={{ opacity: isValid ? 1 : 0.5 }}
            >
              Next
            </button>
          </div>

          {/* Error bucket */}
          {showErrors && (
            <ul className="error-list">
              {Object.values(errors).map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          )}
        </form>
      )}

      {/* STEP-3 ───────────────────── */}
      {step === 3 && (
        <section>
          <h3>Step 3 – Optional Details</h3>

          <textarea
            placeholder="Description"
            value={data.description}
            onChange={e => setData(p => ({ ...p, description: e.target.value }))}
          />

          {/* Tags & Genres */}
          <div className="row cols-2">
            <div className="flex-half">
              <label>Tags</label>
              <select
                multiple
                value={data.tags}
                onChange={e => setData(p => ({
                  ...p,
                  tags: Array.from(e.target.selectedOptions, o => o.value),
                }))}
              >
                {tagOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-half">
              <label>Genres</label>
              <select
                multiple
                value={data.genres}
                onChange={e => setData(p => ({
                  ...p,
                  genres: Array.from(e.target.selectedOptions, o => o.value),
                }))}
              >
                {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {/* Payment / social URLs */}
          <div className="row cols-2">
            <div className="flex-half">
              <input
                placeholder="PayPal URL"
                value={data.payPalUrl}
                onChange={e => setData(p => ({ ...p, payPalUrl: e.target.value }))}
              />
            </div>
            <div className="flex-half">
              <input
                placeholder="Venmo URL"
                value={data.venmoUrl}
                onChange={e => setData(p => ({ ...p, venmoUrl: e.target.value }))}
              />
            </div>
          </div>

          <div className="row cols-2">
            <div className="flex-half">
              <input
                placeholder="Spotify URL"
                value={data.spotifyUrl}
                onChange={e => setData(p => ({ ...p, spotifyUrl: e.target.value }))}
              />
            </div>
            <div className="flex-half">
              <input
                placeholder="YouTube URL"
                value={data.youTubeUrl}
                onChange={e => setData(p => ({ ...p, youTubeUrl: e.target.value }))}
              />
            </div>  
          </div>

          <input
            placeholder="TikTok URL"
            value={data.tikTokUrl}
            onChange={e => setData(p => ({ ...p, tikTokUrl: e.target.value }))}
          />

          {/* 2-column row */}
          <div className="row cols-2">
            <div>
              <label className="mt-0">Theme Color</label>
              <input
                type="color"
                value={data.themeColor}
                onChange={e => setData(p => ({ ...p, themeColor: e.target.value }))}
                style={{ width: 100 }}
              />
            </div>

            <div>
              <input
                multiple
                type="file"
                accept="image/*"
                onChange={e => setGalleryFiles(Array.from(e.target.files))}
              />

              {galleryFiles.map((f, i) => {
                const path = `gallery/${Date.now()}_${i}_${f.name}`;
                return (
                  <div key={path}>
                    {f.name}{' '}
                    <button type="button" onClick={() => uploadFile(f, path, 'images')}>
                      Upload
                    </button>
                    {uploadPct[path] && <progress value={uploadPct[path]} max={100} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nav */}
          <div className="nav-buttons">
            <button className="secondary" onClick={() => setStep(2)}>Back</button>
            <button onClick={finish}>Finish</button>
          </div>
        </section>
      )}

      {status && <p style={{ color: 'crimson' }}>{status}</p>}
    </div>
  );
}
