const paths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  store: <><path d="M4 10v11h16V10M3 10l2-7h14l2 7M3 10c0 4 4 4 5 0 1 4 7 4 8 0 1 4 5 4 5 0M9 21v-6h6v6"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  chef: <><path d="M7 17h10v4H7zM7 17v-5a4 4 0 0 1-1-8 5 5 0 0 1 12 0 4 4 0 0 1-1 8v5M10 12v5m4-5v5"/></>,
  bell: <><path d="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5l-2 3ZM10 21h4"/></>,
  users: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/></>,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6"/>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
  external: <><path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  bag: <><path d="M5 7h14l1 14H4L5 7ZM8 8V6a4 4 0 0 1 8 0v2"/></>,
  leaf: <path d="M20 3C9 2 3 9 6 16c5 7 16 1 14-13ZM5 21 16 9"/>,
  qr: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h4v4h-7v-3m7-4v1"/></>,
  dish: <><path d="M3 16h18M5 16a7 7 0 0 1 14 0M12 7V4m-1 0h2M4 20h16"/></>,
  edit: <path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3m0 3h.01"/></>,
  swap: <path d="M4 7h16l-4-4m4 14H4l4 4"/>,
};
export default function Icon({name,size=20,className=''}) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]||paths.grid}</svg>;
}
