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
  profileImageUrl: '', profileBannerUrl: '', bannerColors: [],
  description: '', notes: '', thought: '',
  tags: [], genres: [], themeColor: '#008080',
  images: [],
  payPalUrl: '', venmoUrl: '', cashAppTag: '', spotifyUrl: '',
  youTubeUrl: '', tikTokUrl: '', twitterUrl: '', facebookUrl: '', instagramUrl: '',
  videos: [],
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
  const [isFinishing, setIsFinishing] = useState(false);

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
            profileImageUrl: '/default-avatar.jpg', // Set default avatar immediately
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
            // Existing user with completed profile - go to dashboard
            nav('/dashboard');
          } else {
            // Existing user but incomplete profile - continue wizard
            setStep(2);
          }
        } catch (signinError) {
          setStatus(signinError.code === 'auth/wrong-password'
            ? 'Wrong password for existing account'
            : 'Invalid email or password');
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

        // Extract colors if this is a banner image
        let bannerColors = [];
        if (field === 'profileBannerUrl') {
          try {
            console.log('Extracting colors from banner image...');
            bannerColors = await extractDominantColors(file);
            console.log('Extracted colors:', bannerColors);
            setData(p => ({ ...p, bannerColors }));
          } catch (error) {
            console.error('Error extracting colors:', error);
            // Continue without colors if extraction fails
          }
        }

        // Save to database
        const updateData = { [field]: field === 'images' ? arrayUnion(url) : url };
        if (field === 'profileBannerUrl' && bannerColors.length > 0) {
          updateData.bannerColors = bannerColors;
          console.log('Saving banner colors to database:', bannerColors);
        }

        console.log('Saving to database:', updateData);
        await setDoc(
          doc(db, 'recipients', auth.currentUser.uid),
          updateData,
          { merge: true }
        );
      }
    );
  };

  /* Finish */
  // persist URL so finish() can't overwrite
  const finish = async () => {
    if (isFinishing) return; // Prevent multiple clicks
    setIsFinishing(true);
    
    try {
      console.log('Finish: Original data:', data);
      console.log('Finish: Banner colors before filtering:', data.bannerColors);
      
      // Wait a moment for any pending uploads to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the latest data from the database to ensure we have the most recent banner colors
      try {
        const docSnap = await getDoc(doc(db, 'recipients', auth.currentUser.uid));
        if (docSnap.exists()) {
          const latestData = docSnap.data();
          console.log('Finish: Latest data from database:', latestData);
          console.log('Finish: Latest banner colors from database:', latestData.bannerColors);
          
          // Merge the latest data with current form data
          const mergedData = { ...data, ...latestData };
          console.log('Finish: Merged data:', mergedData);
          
          const clean = Object.fromEntries(
            Object.entries(mergedData).filter(([k, v]) => {
              // Keep bannerColors even if it's an empty array
              if (k === 'bannerColors') {
                console.log('Finish: Keeping bannerColors:', v);
                return true;
              }
              // Keep other non-empty values
              const shouldKeep = v !== '';
              if (!shouldKeep) {
                console.log('Finish: Filtering out:', k, v);
              }
              return shouldKeep;
            })
          );
          
          console.log('Finish: Cleaned data:', clean);
          console.log('Finish: Banner colors after filtering:', clean.bannerColors);
          
          const finalData = { ...clean, completed: true, completedAt: serverTimestamp() };
          console.log('Finish: Final data to save:', finalData);
          
          await setDoc(
            doc(db, 'recipients', auth.currentUser.uid),
            finalData,
            { merge: true }
          );
        }
      } catch (error) {
        console.error('Finish: Error getting latest data:', error);
        // Fallback to original logic
        const clean = Object.fromEntries(
          Object.entries(data).filter(([k, v]) => {
            if (k === 'bannerColors') return true;
            return v !== '';
          })
        );
        await setDoc(
          doc(db, 'recipients', auth.currentUser.uid),
          { ...clean, completed: true, completedAt: serverTimestamp() },
          { merge: true }
        );
      }
      
      nav('/dashboard');
    } catch (error) {
      console.error('Finish: Error during finish process:', error);
      setStatus('Error completing profile. Please try again.');
      setIsFinishing(false);
    }
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

          <textarea
            placeholder="Thought (optional) - A personal quote or reflection to share with visitors"
            value={data.thought}
            onChange={e => setData(p => ({ ...p, thought: e.target.value }))}
            style={{ minHeight: '80px' }}
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

          {/* Payment / social handles */}
          <div className="row cols-2">
            <div className="flex-half">
              <input
                placeholder="PayPal.Me username"
                value={data.payPalUrl}
                onChange={e => setData(p => ({ ...p, payPalUrl: e.target.value }))}
              />
            </div>
            <div className="flex-half">
              <input
                placeholder="Venmo username"
                value={data.venmoUrl}
                onChange={e => setData(p => ({ ...p, venmoUrl: e.target.value }))}
              />
            </div>
          </div>

          <div className="row cols-2">
            <div className="flex-half">
              <input
                placeholder="Cash App $cashtag"
                value={data.cashAppTag}
                onChange={e => setData(p => ({ ...p, cashAppTag: e.target.value }))}
              />
            </div>
            <div className="flex-half">
              <input
                placeholder="Spotify URL"
                value={data.spotifyUrl}
                onChange={e => setData(p => ({ ...p, spotifyUrl: e.target.value }))}
              />
            </div>
          </div>

          <div className="row cols-2">
            <div className="flex-half">
              <input
                placeholder="YouTube URL"
                value={data.youTubeUrl}
                onChange={e => setData(p => ({ ...p, youTubeUrl: e.target.value }))}
              />
            </div>
            <div className="flex-half">
              <input
                placeholder="TikTok URL"
                value={data.tikTokUrl}
                onChange={e => setData(p => ({ ...p, tikTokUrl: e.target.value }))}
              />
            </div>
          </div>

          <div className="row cols-2">
            <div className="flex-half">
              <input
                placeholder="Twitter URL"
                value={data.twitterUrl}
                onChange={e => setData(p => ({ ...p, twitterUrl: e.target.value }))}
              />
            </div>
            <div className="flex-half">
              <input
                placeholder="Facebook URL"
                value={data.facebookUrl}
                onChange={e => setData(p => ({ ...p, facebookUrl: e.target.value }))}
              />
            </div>
          </div>

          <div className="row cols-2">
            <div className="flex-half">
              <input
                placeholder="Instagram URL"
                value={data.instagramUrl}
                onChange={e => setData(p => ({ ...p, instagramUrl: e.target.value }))}
              />
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
                value={data.videoUrl || ''}
                onChange={e => setData(p => ({ ...p, videoUrl: e.target.value }))}
                style={{ width: '100%', marginBottom: '0.5rem' }}
              />
              <button
                type="button"
                onClick={async () => {
                  if (data.videoUrl && data.videoUrl.trim()) {
                    const videoId = extractYouTubeVideoId(data.videoUrl);
                    if (videoId) {
                      // Verify the video exists
                      try {
                        const response = await fetch(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, {
                          method: 'HEAD'
                        });
                        if (response.ok) {
                          setData(p => ({
                            ...p,
                            videos: [...p.videos, { url: data.videoUrl, id: videoId }],
                            videoUrl: ''
                          }));
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
              {data.videos.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#a8a8a5', fontSize: '14px' }}>Added Videos:</h4>
                  {data.videos.map((video, index) => (
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
                        onClick={() => setData(p => ({
                          ...p,
                          videos: p.videos.filter((_, i) => i !== index)
                        }))}
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
            <button className="secondary" onClick={() => setStep(2)} disabled={isFinishing}>Back</button>
            <button onClick={finish} disabled={isFinishing}>
              {isFinishing ? 'Finishing...' : 'Finish'}
            </button>
          </div>
        </section>
      )}

      {status && <p style={{ color: 'crimson' }}>{status}</p>}
    </div>
  );
}
