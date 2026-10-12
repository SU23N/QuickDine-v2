import {useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import Icon from './Icon';
import useMediaQuery from '../hooks/useMediaQuery';
export default function SaasFrame({children,title,subtitle,section='Overview',admin=false,restaurantId='yash-bagbahara',name='QuickDine',demo=false,onSelectRestaurant,restaurants=[],role='owner',headerActions}) {
  const location=useLocation(),mobile=useMediaQuery('(max-width: 900px)'),[menuOpen,setMenuOpen]=useState(false),sidebar=useRef(null),toggle=useRef(null);
  useEffect(()=>setMenuOpen(false),[location.pathname,location.search,mobile]);
  useEffect(()=>{
    if(!mobile||!menuOpen)return;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    const focusable=()=>Array.from(sidebar.current?.querySelectorAll('a[href],button:not([disabled]),select')||[]);
    focusable()[0]?.focus();
    const keydown=e=>{if(e.key==='Escape'){e.preventDefault();setMenuOpen(false);}if(e.key==='Tab'){const els=focusable(),first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
    document.addEventListener('keydown',keydown);
    return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',keydown);toggle.current?.focus();};
  },[mobile,menuOpen]);
  const ownerItems=[['Workspace',`/r/${restaurantId}/owner`,'grid'],['Menu & QR',`/r/${restaurantId}/admin`,'qr'],['Kitchen',`/r/${restaurantId}/kitchen`,'chef'],['Waiter',`/r/${restaurantId}/waiter`,'bell'],['Brand & team',`/r/${restaurantId}/settings`,'users'],['Subscription',`/r/${restaurantId}/billing`,'card'],['Customer menu',`/r/${restaurantId}/customer?mode=takeaway`,'external']];
  const items=admin?[['Overview','/console','grid'],['Restaurants','/console?tab=restaurants','store'],['Subscriptions','/console?tab=billing','card'],['Plans','/console?tab=plans','receipt'],['Activity','/console?tab=activity','clock']]:role==='owner'?ownerItems:ownerItems.filter(([label])=>['Kitchen','Customer menu',...(role==='waiter'?['Waiter']:[])].includes(label));
  return <div className="saas-app ui-v4">
    {demo&&<div className="review-banner"><strong>DEMO WORKSPACE</strong><span>Changes stay in this browser. Orders and payments here are demonstrations.</span><Link to="/setup">Live launch requirements ↗</Link></div>}
    <div className="saas-layout">
      {mobile&&menuOpen&&<button className="navigation-backdrop" aria-label="Close navigation" onClick={()=>setMenuOpen(false)}/>}
      <aside id="workspace-navigation" ref={sidebar} inert={mobile&&!menuOpen?true:undefined} className={`saas-sidebar ${menuOpen?'navigation-open':''}`} aria-label="Workspace navigation">
        <div className="sidebar-brand-row"><Link className="saas-logo" to={admin?'/console':'/workspace'}><span>Q</span><strong>QuickDine<small>RESTAURANT OPERATING SYSTEM</small></strong></Link>{mobile&&<button className="sidebar-close" aria-label="Close navigation" onClick={()=>setMenuOpen(false)}><Icon name="close"/></button>}</div>
        <div className="workspace-pill"><span>{admin?'PLATFORM WORKSPACE':'RESTAURANT WORKSPACE'}</span><strong>{admin?'Nayak · Central Admin':name}</strong>{onSelectRestaurant&&<select aria-label="Select restaurant" value={restaurantId} onChange={e=>onSelectRestaurant(e.target.value)}>{restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>}</div>
        <p className="sidebar-label">MANAGE</p><nav>{items.map(([label,to,icon])=><Link key={label} to={to} className={section===label?'selected':''} aria-current={section===label?'page':undefined}><Icon name={icon}/><span>{label}</span>{section===label&&<i className="nav-active-dot"/>}</Link>)}</nav>
        <div className="sidebar-bottom"><Link to="/workspace"><Icon name="swap" size={18}/>Switch workspace</Link><Link to="/setup"><Icon name="help" size={18}/>Launch & setup</Link><div className="profile-chip"><span>{admin?'SN':name.slice(0,1)}</span><div><strong>{admin?'Surendra Nayak':name}</strong><small>{admin?'Platform administrator':`${role[0].toUpperCase()+role.slice(1)} workspace`}</small></div></div></div>
      </aside>
      <div className="saas-main"><header className="saas-topbar topbar workspace-topbar"><div className="topbar-breadcrumb">{mobile&&<button ref={toggle} className="navigation-toggle" aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={()=>setMenuOpen(true)}><Icon name="menu"/></button>}<span>{admin?'Platform':'Restaurant'}<span className="breadcrumb-slash">/</span>{section}</span></div><div className="topbar-actions">{headerActions}<span className="saas-connected"><i/>{demo?'Local demo':'Workspace'}</span><Link className="avatar" to="/workspace" aria-label="Switch workspace">{admin?'SN':name.slice(0,1)}</Link></div></header>
      <main className="saas-content"><div className="saas-page-head"><div><p className="saas-eyebrow">{admin?'YOUR QUICKDINE NETWORK':'YOUR RESTAURANT, CONNECTED'}</p><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div><span className="date-chip">{new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'})}</span></div>{children}</main><footer className="saas-footer"><strong>QuickDine</strong> A little less waiting. A lot better service.</footer></div>
    </div>
  </div>;
}
