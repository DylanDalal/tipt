// src/Profile.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { db } from './firebase';
import { trackProfileView, trackLinkClick, getVisitorLocation } from './analytics';

export default function Profile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedColor, setCopiedColor] = useState(null);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) return;

    // Set up real-time listener for profile changes
    const unsubscribe = onSnapshot(
      doc(db, 'recipients', uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('Profile: Received update:', data);
          console.log('Profile: Banner colors in update:', data.bannerColors);
          setD(data);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to profile changes:', error);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [uid]);

  // Separate effect for tracking profile views to avoid double counting
  useEffect(() => {
    let hasTracked = false;
    
    const trackView = async () => {
      // Only track if:
      // 1. We have a uid
      // 2. We haven't tracked yet in this session
      // 3. Current user is not the profile owner (or no current user)
      if (uid && !hasTracked && (!currentUser || currentUser.uid !== uid)) {
        hasTracked = true;
        console.log('Tracking profile view for:', { uid, currentUser: currentUser?.uid || 'anonymous' });
        try {
          const visitorLocation = await getVisitorLocation();
          await trackProfileView(uid, visitorLocation);
        } catch (error) {
          console.error('Error tracking profile view:', error);
        }
      } else {
        console.log('Not tracking profile view:', { uid, hasTracked, isOwner: currentUser?.uid === uid });
      }
    };

    // Track for both authenticated and anonymous users
    // We need to wait a bit for auth state to settle, but also handle anonymous users
    const timer = setTimeout(() => {
      trackView();
    }, 100);

    return () => clearTimeout(timer);
  }, [uid, currentUser]);

  // Profile.jsx
  const handleEdit = () => {
    navigate(`/profile/${uid}/edit`); 
  };



  // Handle link clicks with analytics tracking
  // Open the link immediately and then track the click. Mobile browsers
  // often block popups if they are not triggered directly by the user
  // gesture, so we cannot await any async work before calling window.open.
  const handleLinkClick = (linkType, linkValue) => {
    console.log('Link clicked:', {
      linkType,
      linkValue,
      currentUser: currentUser?.uid,
      profileUid: uid
    });

    let url = linkValue;
    if (linkType === 'venmo') {
      url = `https://venmo.com/u/${linkValue.replace(/^@/, '')}`;
    } else if (linkType === 'paypal') {
      url = `https://paypal.me/${linkValue.replace(/^@/, '')}`;
    } else if (linkType === 'cashapp') {
      url = `https://cash.app/${linkValue.replace(/^\$/, '')}`;
    }
    
    // Open the link first to preserve the user gesture
    window.open(url, '_blank', 'noopener,noreferrer');

    // Track the click (only if not the profile owner) without blocking the link
    if (!currentUser || currentUser.uid !== uid) {
      console.log('Tracking link click for non-owner');
      (async () => {
        let visitorLocation = { location: 'Unknown' };
        try {
          visitorLocation = await getVisitorLocation();
        } catch (error) {
          // Location fetch failures shouldn't prevent analytics
          console.error('Error getting visitor location:', error);
        }
        try {
          await trackLinkClick(uid, linkType, url, visitorLocation);
        } catch (error) {
          console.error('Error tracking link click:', error);
        }
      })();
    } else {
      console.log('Not tracking - user is profile owner');
    }
  };


  if (loading) return <p>Loading…</p>;
  if (!d) return <p>Profile not found</p>;

  // Debug logging
  console.log('Profile data:', d);
  console.log('Banner colors:', d.bannerColors);
  console.log('Banner URL:', d.profileBannerUrl);
  console.log('Has banner colors:', d.bannerColors && d.bannerColors.length > 0);

  const canEdit = currentUser && currentUser.uid === uid;

  const venmoLink = d.venmoUsername
    ? `https://venmo.com/${d.venmoUsername.replace(/^@/, '')}`
    : d.venmoUrl;
  const cashAppLink = d.cashAppUsername
    ? `https://cash.app/$${d.cashAppUsername.replace(/^\$+/, '')}`
    : d.cashAppUrl;
  const payPalLink = d.payPalUsername
    ? `https://paypal.me/${d.payPalUsername.replace(/^@/, '')}`
    : d.payPalUrl;

  return (
    <article style={{
      maxWidth: 680,
      margin: '5rem auto',
      padding: '0 1rem',
      display: 'block',
      position: 'relative',
      zIndex: 1
    }}>
      {/* Edit button for profile owner */}


      {/* banner */}
      {d.profileBannerUrl && (
        <img 
          src={d.profileBannerUrl} 
          alt="banner"
          style={{
            width: '100%',
            borderRadius: 8,
            marginBottom: 16,
            display: 'block'
          }}
        />
      )}

      {/* banner colors */}
      {d.bannerColors && d.bannerColors.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '16px',
          justifyContent: 'center',
          padding: '12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ fontSize: '12px', color: '#666', marginRight: '8px', display: 'flex', alignItems: 'center' }}>
            Colors:
          </div>
          {d.bannerColors.map((color, index) => {
            const roles = ['Primary', 'Secondary', 'Highlight'];
            const role = roles[index] || `Color ${index + 1}`;
            return (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div
                  title={`${role}: ${color} (Click to copy)`}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(color);
                      setCopiedColor(color);
                      setTimeout(() => setCopiedColor(null), 2000);
                    } catch (error) {
                      console.error('Failed to copy color to clipboard:', error);
                      // Fallback for older browsers
                      const textArea = document.createElement('textarea');
                      textArea.value = color;
                      document.body.appendChild(textArea);
                      textArea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textArea);
                      setCopiedColor(color);
                      setTimeout(() => setCopiedColor(null), 2000);
                    }
                  }}
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: color,
                    borderRadius: '50%',
                    border: copiedColor === color ? '3px solid #008080' : '2px solid #fff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transform: copiedColor === color ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.2s ease'
                  }}
                />
                <div style={{ 
                  fontSize: '10px', 
                  color: '#666', 
                  fontWeight: '500',
                  textAlign: 'center'
                }}>
                  {role}
                </div>
              </div>
            );
          })}
        </div>
      )}





      {/* header */}
      <header style={{display:'flex',gap:16,alignItems:'center'}}>
        <img src={d.profileImageUrl || '/default-avatar.jpg'} alt="profile" width={120}
            style={{borderRadius:'50%'}}/>
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
        {venmoLink&&<h3>Venmo: <span
          onClick={() => handleLinkClick('venmo', venmoLink)}
          style={{color: '#008080', cursor: 'pointer', textDecoration: 'underline'}}
        >{venmoLink}</span></h3>}
        {cashAppLink&&<h3>CashApp: <span
          onClick={() => handleLinkClick('cashapp', cashAppLink)}
          style={{color: '#008080', cursor: 'pointer', textDecoration: 'underline'}}
        >{cashAppLink}</span></h3>}
        {payPalLink&&<h3>PayPal: <span
          onClick={() => handleLinkClick('paypal', payPalLink)}
          style={{color: '#008080', cursor: 'pointer', textDecoration: 'underline'}}
        >{payPalLink}</span></h3>}
        {d.spotifyUrl&&<h3>Spotify: <span 
          onClick={() => handleLinkClick('spotify', d.spotifyUrl)}
          style={{color: '#008080', cursor: 'pointer', textDecoration: 'underline'}}
        >{d.spotifyUrl}</span></h3>}
        {d.youTubeUrl&&<h3>YouTube: <span 
          onClick={() => handleLinkClick('youtube', d.youTubeUrl)}
          style={{color: '#008080', cursor: 'pointer', textDecoration: 'underline'}}
        >{d.youTubeUrl}</span></h3>}
        {d.tikTokUrl&&<h3>TikTok: <span 
          onClick={() => handleLinkClick('tiktok', d.tikTokUrl)}
          style={{color: '#008080', cursor: 'pointer', textDecoration: 'underline'}}
        >{d.tikTokUrl}</span></h3>}
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
