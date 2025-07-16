import { Routes, Route } from 'react-router-dom';
import SignupWizard from './SignupWizard';
import EditProfile from './EditProfile';
import Profile from './Profile';
import Home from './Home';
import Navbar from './Navbar';


console.log(import.meta.env.VITE_FIREBASE_API_KEY)
console.log(import.meta.env.VITE_FIREBASE_APP_ID)
console.log(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
console.log(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID)
console.log(import.meta.env.VITE_FIREBASE_PROJECT_ID)
console.log(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)


export default function App() {
  return (
    <>
      <Navbar />
      <div>
        <Routes>
          <Route path="/signup" element={<SignupWizard />} />
          <Route path="/profile/:uid" element={<Profile />} />
          <Route path="/profile/:uid/edit"   element={<EditProfile />} />
          <Route path="*" element={<Home/>} />
        </Routes>
      </div>
    </>
  );
}