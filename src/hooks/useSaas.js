import {useEffect,useState} from 'react';
import {collection,doc,query,where,orderBy,limit,onSnapshot} from 'firebase/firestore';
import {db} from '../firebase/config';
import {useTenant} from './useTenant';
import {useSession} from './useSession';
export function useRows(path,filters=[],enabled=true){
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(Boolean(db&&enabled));
  const filterKey=JSON.stringify(filters);
  useEffect(()=>{
    setRows([]);setError('');setLoading(Boolean(db&&enabled));if(!db||!enabled)return;
    const constraints=filters.map(([type,key,value])=>type==='where'?where(key,value[0],value[1]):type==='order'?orderBy(key,value):limit(key));
    return onSnapshot(query(collection(db,...path.split('/')),...constraints),s=>{setRows(s.docs.map(d=>({...d.data(),id:d.id})));setLoading(false);},e=>{setError(e.message);setLoading(false);});
  },[path,filterKey,enabled]);
  return {rows,error,loading};
}
export function useRecord(path,enabled=true){
  const [record,setRecord]=useState(null),[error,setError]=useState('');
  useEffect(()=>{setRecord(null);setError('');if(!db||!enabled)return;return onSnapshot(doc(db,...path.split('/')),s=>setRecord(s.exists()?{...s.data(),id:s.id}:null),e=>setError(e.message));},[path,enabled]);
  return {record,error};
}
export function useSubscription(){const {restaurantId}=useTenant(),{staff}=useSession();return useRecord(`subscriptions/${restaurantId}`,staff?.role==='owner');}
export function useMetrics(){const {restaurantId}=useTenant();const day=new Date(Date.now()+330*60000).toISOString().slice(0,10);return {daily:useRecord(`restaurants/${restaurantId}/dailyMetrics/${day}`).record,current:useRecord(`restaurants/${restaurantId}/metrics/current`).record};}
export function saasDate(value){const ms=typeof value?.toMillis==='function'?value.toMillis():typeof value==='number'?value:value?.seconds?value.seconds*1000:0;return ms?new Date(ms).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'}):'—';}
