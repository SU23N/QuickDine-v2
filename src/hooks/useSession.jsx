import {createContext,useContext,useEffect,useState} from 'react';
import {onAuthStateChanged,signInAnonymously} from 'firebase/auth';
import {doc,collection,onSnapshot} from 'firebase/firestore';
import {auth,db,configured} from '../firebase/config';
import {useTenant} from './useTenant';
export const SessionContext=createContext(null);
export const useSession=()=>useContext(SessionContext);
export function useSessionState(){
 const {restaurantId}=useTenant();
 const [user,setUser]=useState(null),[legacy,setLegacy]=useState(null),[memberships,setMemberships]=useState([]),[platformAdmin,setPlatformAdmin]=useState(false),[loading,setLoading]=useState(configured),[error,setError]=useState('');
 useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,u=>{setUser(u);setLegacy(null);setMemberships([]);setPlatformAdmin(false);setLoading(Boolean(u));setError('');});},[]);
 useEffect(()=>{
  if(!db||!user){setLoading(false);return;}
  const ready=new Set();const done=key=>{ready.add(key);if(ready.size===3)setLoading(false);};const fail=key=>e=>{setError(e.message);done(key);};
  const stop=[onSnapshot(doc(db,'staff',user.uid),s=>{setLegacy(s.data()||null);done('legacy');},fail('legacy')),onSnapshot(collection(db,'memberships',user.uid,'restaurants'),s=>{setMemberships(s.docs.map(d=>({...d.data(),restaurantId:d.id})));done('memberships');},fail('memberships')),onSnapshot(doc(db,'platformAdmins',user.uid),s=>{setPlatformAdmin(s.data()?.active===true);done('admin');},fail('admin'))];return ()=>stop.forEach(fn=>fn());
 },[user?.uid]);
 const canonical=memberships.find(m=>m.restaurantId===restaurantId),member=canonical!==undefined?canonical:legacy?.restaurantId===restaurantId?legacy:null;
 const staff=platformAdmin?{role:'owner',active:true,restaurantId,platformAdmin:true}:member?.active===true?member:null;
 async function ensureCustomer(){if(!auth)throw Error('Ordering is unavailable.');return auth.currentUser || (await signInAnonymously(auth)).user;}
 return {user,staff,memberships,legacy,platformAdmin,loading,error,ensureCustomer};
}
