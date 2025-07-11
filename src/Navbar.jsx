// src/Navbar.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import './Navbar.css';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthClick = () => {
    if (user) {
      navigate(`/profile/${user.uid}`);
    } else {
      navigate('/signup');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-logo">
          <img src="/tipt_logo.svg" alt="TIPT" />
        </Link>
        
        <div className="navbar-buttons">
          {user ? (
            <>
              <button className="navbar-btn" onClick={handleAuthClick}>
                Profile
              </button>
              <button className="navbar-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button className="navbar-btn" onClick={handleAuthClick}>
                Login
              </button>
              <button className="navbar-btn" onClick={handleAuthClick}>
                Signup
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}