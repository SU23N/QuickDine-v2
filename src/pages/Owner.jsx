import {Link} from 'react-router-dom';
import RestaurantFrame from '../components/RestaurantFrame';
import {ServiceOverview} from '../components/OverviewPanels';
import Icon from '../components/Icon';
import OrderCard from '../components/OrderCard';
import {useSession} from '../hooks/useSession';
import {useOrders} from '../hooks/useOrders';
import {useMetrics,useSubscription,saasDate} from '../hooks/useSaas';
import {useTenant} from '../hooks/useTenant';
import {useLanguage,money} from '../lib/i18n';
import {subscriptionState} from '../../functions/saas-domain';
export default function Owner(){
 const {user}=useSession(),{orders,loading,error}=useOrders(user?.uid,true),{t}=useLanguage(),{path,restaurantId}=useTenant();
 const {daily,current,error:metricsError}=useMetrics(),{record:subscription}=useSubscription();
 const today=new Date(Date.now()+330*60000).toISOString().slice(0,10),sales=daily?.salesPaise||0,paid=daily?.paidOrders||0;
 return <RestaurantFrame section="Workspace" title={t('overview')} subtitle={`Today's service, sales and orders · IST ${today}`}>
 {loading&&<p>{t('loading')}</p>}{(error||metricsError)&&<p className="error" role="alert">{error||metricsError}</p>}
 {subscription&&<p className="subscription-summary">{subscription.planName} · {subscriptionState(subscription)} · Access through {saasDate(subscription.currentPeriodEnd)} · <Link to={path('billing')}>Manage subscription</Link></p>}
 <div className="stats"><Stat title={t('sales')} value={money(sales)}/><Stat title={t('orders')} value={daily?.orders||0}/><Stat title={t('active')} value={current?.activeOrders||0}/><Stat title={t('average')} value={money(paid?Math.round(sales/paid):0)}/></div>
 <ServiceOverview orders={orders} restaurantId={restaurantId}/>
 <section className="saas-panel"><div className="panel-head"><div><h2>{t('yourOrders')}</h2><p>Latest 200 orders. Daily metrics include all recorded transactions.</p></div><span className="state-badge active">{orders.length} loaded</span></div><div className="order-grid">{orders.map(o=><OrderCard key={o.id} order={o} role="owner"/>)}</div>
 {!loading&&!orders.length&&<div className="saas-empty"><Icon name="receipt" size={32}/><h3>{t('noOrders')}</h3><p>Orders will appear here as customers place them.</p><Link className="saas-text-link" to={path('customer')}>Open customer menu</Link></div>}</section></RestaurantFrame>;
}
function Stat({title,value}){return <div className="stat-card"><span>{title}</span><strong>{value}</strong></div>;}
