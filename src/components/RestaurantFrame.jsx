import {signOut} from 'firebase/auth';
import SaasFrame from './SaasFrame';
import {useTenant} from '../hooks/useTenant';
import {useRecord} from '../hooks/useSaas';
import {useSession} from '../hooks/useSession';
import {useLanguage} from '../lib/i18n';
import {auth} from '../firebase/config';
export default function RestaurantFrame({children,title,subtitle,section,viewRole}) {
  const {restaurantId}=useTenant(),{record:restaurant}=useRecord(`restaurants/${restaurantId}`),{staff,user}=useSession(),{lang,setLang}=useLanguage();
  return <SaasFrame restaurantId={restaurantId} name={restaurant?.name||restaurantId} role={staff?.role||viewRole||'owner'} title={title} subtitle={subtitle} section={section} headerActions={<><button className="header-action" aria-label="Switch language" onClick={()=>setLang(lang==='en'?'hi':'en')}>{lang==='en'?'हिन्दी':'English'}</button>{user&&!user.isAnonymous&&<button className="header-action" onClick={()=>signOut(auth)}>Sign out</button>}</>}>{children}</SaasFrame>;
}
