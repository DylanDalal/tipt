import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export default function Profile() {
  const { uid } = useParams();
  const [d, setD] = useState(null);
  useEffect(()=>{ getDoc(doc(db,'recipients',uid)).then(s=>setD(s.data())); },[uid]);
  if(!d) return <p>Loading…</p>;

  return (
    <article style={{maxWidth:680,margin:'2rem auto',padding:'0 1rem'}}>
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
    </article>
  );
}
