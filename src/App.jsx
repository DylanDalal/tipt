import { Routes, Route } from 'react-router-dom';
import SignupWizard from './SignupWizard';
import EditProfile from './EditProfile';
import Profile from './Profile';
import Home from './Home';
import Navbar from './Navbar';


console.log(import.meta.env.VITE_FIREBASE_API_KEY)


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