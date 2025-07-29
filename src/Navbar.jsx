// src/Navbar.jsx
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import './Navbar.css';

export default function Navbar() {
  const [user, setUser]           = useState(null);
  const [photo, setPhoto]         = useState('');
  const [open, setOpen]           = useState(false);
  const nav                       = useNavigate();
  const menuRef                   = useRef(null);

  /* track auth */
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async user => {
      setUser(user);
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'recipients', user.uid));
          if (snap.exists()) {
            const userData = snap.data();
            // Show default avatar during signup, custom avatar after completion
            if (userData.completed) {
              setPhoto(userData.profileImageUrl || '/default-avatar.jpg');
            } else {
              // User is still in signup wizard - show default avatar
              setPhoto('/default-avatar.jpg');
            }
          } else {
            setPhoto('/default-avatar.jpg');
          }
        } catch {
          setPhoto('/default-avatar.jpg');
        }
      } else {
        setPhoto('');
      }
    });
    return unsubAuth;
  }, []);


  /* close dropdown on outside click */
  useEffect(() => {
    const onClick = e => !menuRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const logout = async () => {
    await signOut(auth);
    setOpen(false);
    nav('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-logo">
          <img src="/tipt_logo.svg" alt="TIPT" />
        </Link>

        {!user && (
          <div className="navbar-buttons">
            <button onClick={() => nav('/signup')}>Login</button>
            <button onClick={() => nav('/signup')}>Signup</button>
          </div>
        )}

        {user && (
          <div ref={menuRef} className="avatar-wrapper">
            <img
              src={photo}
              alt="profile"
              className="avatar-img"
              onClick={() => setOpen(p => !p)}
            />
            {open && (
              <ul className="avatar-menu">
                <li onClick={() => { nav('/dashboard'); setOpen(false); }}>Dashboard</li>
                <li onClick={() => { nav(`/profile/${user.uid}`); setOpen(false); }}>Profile</li>
                <li onClick={logout}>Logout</li>
              </ul>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
