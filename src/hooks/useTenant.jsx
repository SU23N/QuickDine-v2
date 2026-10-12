import { createContext,useContext,useMemo } from 'react';
import { useMatch } from 'react-router-dom';
import { restaurantId as defaultRestaurantId } from '../firebase/config';
const TenantContext=createContext(null);
export function TenantProvider({children}) {
  const match=useMatch('/r/:restaurantId/*'), id=match?.params.restaurantId || defaultRestaurantId;
  const value=useMemo(()=>({restaurantId:id,path:(page='customer')=>`/r/${encodeURIComponent(id)}/${page}`}),[id]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
export function useTenant(){return useContext(TenantContext);}
