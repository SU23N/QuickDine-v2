# QuickDine — pehle yeh padhein

Yeh tested source update hai. GitHub integration ne branch create par HTTP 403 diya, isliye GitHub repository/main mein yeh changes abhi push nahi hue hain.

1. ZIP ko ek **naye folder** mein extract karein. Purane project ki copy backup ke liye rakhein.
2. Node **22** use karein. Terminal mein extracted `QuickDine-v2` folder kholein.
3. Yeh commands chalayein:

```sh
npm ci
npm ci --prefix functions
npm run dev
```

4. Terminal ka local URL browser mein kholein. Bina Firebase config ke menu/cart preview milega; order submission disabled rahega.
5. Real ordering ke liye `.env.example` ki copy `.env.local` banayein aur Firebase web-app configuration bharein. Email/password aur anonymous login enable karein. `README.md` mein staff-account permissions aur deployment ki poori instructions hain.
6. Firebase console/Admin SDK se owner, kitchen aur waiter ki staff permissions set karein. Kisi user ko owner banane ka public button nahi hai.
7. Owner login ke baad Admin page se restaurant/sample menu initialize karein. Dishes, prices, Hindi text aur service hours check karein, phir ordering on karein.
8. Published website se table QR generate karein. Localhost QR restaurant mein use na karein.

GitHub par upload/PR ke liye integration ko `SU23N/QuickDine-v2` ka repository write access dena hoga. Yeh package uske baad push kiya ja sakta hai.

**Release abhi live nahi hui hai.** Voice ordering, online payment, delivery, refunds aur holiday schedules is update mein nahi hain. `RELEASE_CHECKLIST.md` ke pilot aur public-launch gates poore karein.
