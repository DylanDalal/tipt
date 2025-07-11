// src/Profile.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';

export default function Profile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'recipients', uid));
        if (docSnap.exists()) {
          setD(docSnap.data());
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (uid) {
      fetchProfile();
    }
  }, [uid]);

  // Profile.jsx
  const handleEdit = () => {
    navigate(`/profile/${uid}/edit`); 
  };


  if (loading) return <p>Loading…</p>;
  if (!d) return <p>Profile not found</p>;

  const canEdit = currentUser && currentUser.uid === uid;

  return (
    <article style={{maxWidth:680,margin:'5rem auto',padding:'0 1rem'}}>
      {/* Edit button for profile owner */}


      {/* banner */}
      {d.profileBannerUrl&&<img src={d.profileBannerUrl} alt="banner"
          style={{width:'100%',borderRadius:8,marginBottom:16}}/>}

      {/* header */}
      <header style={{display:'flex',gap:16,alignItems:'center'}}>
        {d.profileImageUrl&&<img src={d.profileImageUrl} alt="profile" width={120}
            style={{borderRadius:'50%'}}/>}
        <div>
          <h1 style={{margin:0}}>{d.firstName} {d.lastName}</h1>
          {d.altName&&<h2 style={{margin:'4px 0',fontWeight:400,fontSize:'1rem',opacity:.8}}>
            {d.altName}</h2>}
          <h2 style={{margin:'4px 0',fontWeight:400,fontSize:'1rem'}}>
            {d.city}, {d.state}
          </h2>
          <h2 style={{margin:'4px 0',fontWeight:400,fontSize:'1rem'}}>
            {d.email}
          </h2>
        </div>
      </header>

      {/* body */}
      {d.description&&<p style={{marginTop:24,whiteSpace:'pre-wrap'}}>{d.description}</p>}
      
      {/* payments & socials */}
      <section style={{marginTop:32}}>
        {d.acceptsApplePay&&<h3>Apple Pay Enabled</h3>}
        {d.acceptsGooglePay&&<h3>Google Pay Enabled</h3>}
        {d.acceptsSamsungPay&&<h3>Samsung Pay Enabled</h3>}
        {d.venmoUrl&&<h3>Venmo: <a href={d.venmoUrl}>{d.venmoUrl}</a></h3>}
        {d.payPalUrl&&<h3>PayPal: <a href={d.payPalUrl}>{d.payPalUrl}</a></h3>}
        {d.spotifyUrl&&<h3>Spotify: <a href={d.spotifyUrl}>{d.spotifyUrl}</a></h3>}
        {d.youTubeUrl&&<h3>YouTube: <a href={d.youTubeUrl}>{d.youTubeUrl}</a></h3>}
        {d.tikTokUrl&&<h3>TikTok: <a href={d.tikTokUrl}>{d.tikTokUrl}</a></h3>}
      </section>

      {/* gallery */}
      {!!d.images?.length&&(
        <>
          <h3 style={{marginTop:32}}>Gallery</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,120px)',gap:8}}>
            {d.images.map((url,i)=><img key={i} src={url} alt=""
              style={{width:'100%',borderRadius:4,objectFit:'cover'}}/>)}
          </div>
        </>
      )}
      {canEdit && (
        <div style={{textAlign: 'right', marginBottom: '1rem'}}>
          <button 
            onClick={handleEdit}
            style={{
              background: '#ea8151',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Edit Profile
          </button>
        </div>
      )}
    </article>
  );
}