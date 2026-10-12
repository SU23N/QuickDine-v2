import {Link} from 'react-router-dom';
import Nav from '../components/Nav';
import OrderCard from '../components/OrderCard';
import {useSession} from '../hooks/useSession';
import {useOrders} from '../hooks/useOrders';
import {useMetrics,useSubscription,saasDate} from '../hooks/useSaas';
import {useTenant} from '../hooks/useTenant';
import {useLanguage,money} from '../lib/i18n';
import {subscriptionState} from '../../functions/saas-domain';
export default function Owner(){
 const {user}=useSession(),{orders,loading,error}=useOrders(user?.uid,true),{t}=useLanguage(),{path}=useTenant();
 const {daily,current,error:metricsError}=useMetrics(),{record:subscription}=useSubscription();
 const today=new Date(Date.now()+330*60000).toISOString().slice(0,10),sales=daily?.salesPaise||0,paid=daily?.paidOrders||0;
 return <><Nav/><main className="dashboard-page"><div className="dashboard-head"><h1>{t('overview')}</h1><span>IST · {today}</span></div>
 {loading&&<p>{t('loading')}</p>}{(error||metricsError)&&<p className="error" role="alert">{error||metricsError}</p>}
 {subscription&&<p className="subscription-summary">{subscription.planName} · {subscriptionState(subscription)} · Access through {saasDate(subscription.currentPeriodEnd)} · <Link to={path('billing')}>Manage subscription</Link></p>}
 <div className="stats"><Stat title={t('sales')} value={money(sales)}/><Stat title={t('orders')} value={daily?.orders||0}/><Stat title={t('active')} value={current?.activeOrders||0}/><Stat title={t('average')} value={money(paid?Math.round(sales/paid):0)}/></div>
 <h2>{t('yourOrders')}</h2><p className="muted">Latest 200 orders. Daily metrics include all recorded transactions.</p><div className="order-grid">{orders.map(o=><OrderCard key={o.id} order={o} role="owner"/>)}</div>
 {!loading&&!orders.length&&<p>{t('noOrders')}</p>}</main></>;
}
function Stat({title,value}){return <div className="stat-card"><span>{title}</span><strong>{value}</strong></div>;}
