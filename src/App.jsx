import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Customer from './pages/Customer'
import Kitchen from './pages/Kitchen'
import Owner from './pages/Owner'
import Admin from './pages/Admin'
export default function App(){return <Routes><Route path="/" element={<Home/>}/><Route path="/customer" element={<Customer/>}/><Route path="/kitchen" element={<Kitchen/>}/><Route path="/owner" element={<Owner/>}/><Route path="/admin" element={<Admin/>}/></Routes>}
