// App.jsx
import { Routes, Route } from 'react-router-dom';
import SignupWizard from './SignupWizard';
import Profile from './Profile';
import Home from './Home'

export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<SignupWizard />} />
      <Route path="/profile/:uid" element={<Profile />} />
      <Route path="*" element={<Home/>} />
    </Routes>
  );
}
