import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import "./Signup.css";
import { db } from './firebase';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    try {
      await addDoc(collection(db, 'signups'), {
        username: username.trim(),
        createdAt: serverTimestamp()
      });
      setStatus('Submitted!');
      setUsername('');
    } catch (err) {
      console.error('Error adding document', err);
      setStatus('Error submitting');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="signup">
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <button type="submit">Sign Up</button>
      {status && <p>{status}</p>}
    </form>
  );
}
