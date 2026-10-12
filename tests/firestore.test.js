import { after, before, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
let env;
const rid = "test-restaurant",
  menu = {
    name: "Paneer",
    nameHi: "पनीर",
    description: "Dish",
    descriptionHi: "",
    category: "Main",
    categoryHi: "",
    pricePaise: 22000,
    veg: true,
    available: true,
    emoji: "🍛",
  };
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-quickdine",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile(
        new URL("../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});
after(async () => {
  await env?.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, "staff", "owner"), {
        restaurantId: rid,
        role: "owner",
        active: true,
      }),
      setDoc(doc(db, "staff", "waiter"), {
        restaurantId: rid,
        role: "waiter",
        active: true,
      }),
      setDoc(doc(db, "staff", "other-owner"), {
        restaurantId: "other",
        role: "owner",
        active: true,
      }),
      setDoc(doc(db, "restaurants", rid), {
        name: "Yash",
        nameHi: "यश",
        acceptingOrders: true,
      }),
      setDoc(doc(db, "restaurants", rid, "menu", "paneer"), menu),
      setDoc(doc(db, "restaurants", rid, "orders", "order1"), {
        customerUid: "customer",
        items: [],
        totalPaise: 22000,
        status: "new",
      }),
      setDoc(doc(db, "restaurants", rid, "orders", "order2"), {
        customerUid: "someone-else",
        items: [],
        totalPaise: 999,
        status: "new",
      }),
    ]);
  });
});
test("public menu is readable; orders require the customer or restaurant staff", async () => {
  const pub = env.unauthenticatedContext().firestore(),
    customer = env.authenticatedContext("customer").firestore();
  await assertSucceeds(getDoc(doc(pub, "restaurants", rid, "menu", "paneer")));
  await assertFails(getDoc(doc(pub, "restaurants", rid, "orders", "order1")));
  await assertSucceeds(
    getDoc(doc(customer, "restaurants", rid, "orders", "order1")),
  );
  await assertFails(
    getDoc(doc(customer, "restaurants", rid, "orders", "order2")),
  );
  await assertFails(
    getDocs(collection(customer, "restaurants", rid, "orders")),
  );
  await assertSucceeds(
    getDocs(
      query(
        collection(customer, "restaurants", rid, "orders"),
        where("customerUid", "==", "customer"),
      ),
    ),
  );
  await assertSucceeds(
    getDocs(
      collection(
        env.authenticatedContext("waiter").firestore(),
        "restaurants",
        rid,
        "orders",
      ),
    ),
  );
  await assertFails(
    getDoc(
      doc(
        env.authenticatedContext("other-owner").firestore(),
        "restaurants",
        rid,
        "orders",
        "order1",
      ),
    ),
  );
});
test("all client order writes and staff self-promotion are denied", async () => {
  for (const uid of ["customer", "owner", "waiter"]) {
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(
      setDoc(doc(db, "restaurants", rid, "orders", "fraud"), {
        customerUid: uid,
        totalPaise: 1,
      }),
    );
    await assertFails(
      setDoc(doc(db, "staff", uid), {
        role: "owner",
        active: true,
        restaurantId: rid,
      }),
    );
  }
  await assertSucceeds(
    getDoc(
      doc(env.authenticatedContext("owner").firestore(), "staff", "owner"),
    ),
  );
  await assertFails(
    getDoc(
      doc(env.authenticatedContext("customer").firestore(), "staff", "owner"),
    ),
  );
});
test("only owners write valid menu prices; client table writes are denied", async () => {
  const owner = env.authenticatedContext("owner").firestore(),
    waiter = env.authenticatedContext("waiter").firestore();
  await assertSucceeds(
    setDoc(doc(owner, "restaurants", rid, "menu", "new-dish"), menu),
  );
  await assertFails(
    setDoc(doc(owner, "restaurants", rid, "menu", "bad"), {
      ...menu,
      pricePaise: -1,
    }),
  );
  await assertFails(
    setDoc(doc(owner, "restaurants", rid, "menu", "bad"), {
      ...menu,
      pricePaise: 1.5,
    }),
  );
  await assertFails(
    setDoc(doc(waiter, "restaurants", rid, "menu", "new-dish"), menu),
  );
  await assertFails(
    setDoc(doc(owner, "restaurants", rid, "tables", "20"), { active: true }),
  );
  await assertFails(
    setDoc(doc(owner, "restaurants", rid, "tables", "0"), { active: true }),
  );
  await assertFails(
    setDoc(doc(owner, "restaurants", rid, "tables", "20"), {
      active: true,
      extra: "bad",
    }),
  );
});

test("restaurant hours and accepting-orders settings are owner-only and validated", async () => {
  const valid = {
    name: "Yash",
    nameHi: "यश",
    acceptingOrders: false,
    openingTime: "10:00",
    closingTime: "22:00",
  };
  const ref = doc(
    env.authenticatedContext("owner").firestore(),
    "restaurants",
    rid,
  );
  await assertSucceeds(updateDoc(ref, valid));
  await assertFails(setDoc(ref, { ...valid, openingTime: "25:00" }));
  await assertFails(setDoc(ref, { ...valid, closingTime: "10:00" }));
  await assertFails(
    setDoc(
      doc(env.authenticatedContext("waiter").firestore(), "restaurants", rid),
      valid,
    ),
  );
});

test('platform admins list restaurants; owners cannot enumerate competitors or change subscription records',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(doc(db,'platformAdmins','platform'),{active:true});
  await setDoc(doc(db,'subscriptions',rid),{status:'active',planId:'pilot'});
  await setDoc(doc(db,'invoices','invoice'),{restaurantId:rid,status:'unpaid',amountPaise:99900});
  await setDoc(doc(db,'tenantAccounts',rid),{ownerEmail:'owner@example.test'});
 });
 const platform=env.authenticatedContext('platform').firestore(),owner=env.authenticatedContext('owner').firestore(),other=env.authenticatedContext('other-owner').firestore();
 await assertSucceeds(getDocs(collection(platform,'restaurants')));
 await assertFails(getDocs(collection(owner,'restaurants')));
 await assertSucceeds(getDoc(doc(owner,'subscriptions',rid)));
 await assertFails(getDoc(doc(other,'subscriptions',rid)));
 await assertFails(getDoc(doc(other,'tenantAccounts',rid)));
 await assertFails(updateDoc(doc(owner,'subscriptions',rid),{status:'active',currentPeriodEnd:9999999999999}));
 await assertFails(updateDoc(doc(owner,'invoices','invoice'),{status:'paid'}));
 await assertFails(setDoc(doc(owner,'platformAdmins','owner'),{active:true}));
 await assertFails(updateDoc(doc(owner,'restaurants',rid),{status:'active',orderingAccessUntil:9999999999999}));
});
test('disabled canonical memberships override old staff records, and membership documents cannot be self-promoted',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();await setDoc(doc(db,'restaurants',rid,'staff','owner'),{role:'owner',active:false});
  await setDoc(doc(db,'memberships','owner','restaurants',rid),{role:'owner',active:false,restaurantId:rid});
 });
 const owner=env.authenticatedContext('owner').firestore();
 await assertFails(getDoc(doc(owner,'restaurants',rid,'orders','order1')));
 await assertSucceeds(getDoc(doc(owner,'memberships','owner','restaurants',rid)));
 await assertFails(updateDoc(doc(owner,'memberships','owner','restaurants',rid),{active:true}));
 await assertFails(updateDoc(doc(owner,'restaurants',rid,'staff','owner'),{active:true}));
});
test('published plans are public while draft prices and private billing history remain restricted',async()=>{
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();await setDoc(doc(db,'plans','pilot'),{name:'Pilot',enabled:true});await setDoc(doc(db,'plans','draft'),{name:'Draft',enabled:false});
 });
 const pub=env.unauthenticatedContext().firestore();
 await assertSucceeds(getDoc(doc(pub,'plans','pilot')));
 await assertFails(getDoc(doc(pub,'plans','draft')));
 await assertFails(getDocs(collection(pub,'plans')));
 await assertSucceeds(getDocs(query(collection(pub,'plans'),where('enabled','==',true))));
 await assertFails(getDocs(collection(pub,'subscriptionPayments')));
});
