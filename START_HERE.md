# QuickDine — pehle yeh padhein

QuickDine ab multi-restaurant SaaS source hai: central admin, private owner workspaces, menu/QR ordering, kitchen, staff access aur subscription billing.

1. Private review website mein console, Yash owner, menu, kitchen aur billing flow try karein. Is version mein data aapke browser mein save hota hai; orders/payments **demo** hain.
2. Live version ke liye Firebase project connect karein. `README.md` mein Authentication, App Check, first administrator aur exact deployment commands hain.
3. Central admin `/console` se Pilot plan initialize karke Yash ka workspace banaye. Real owner email use karein. Private password setup link owner ko khud share karein.
4. Owner real menu, dish prices, logo, service hours aur kitchen/waiter accounts set kare. Ordering shuru mein paused rahegi.
5. Firebase hosting deployment aur supervised pilot ke baad Yash website ke buttons ko `/r/yash-bagbahara/customer`, takeaway aur advance dine-in links se connect karein.
6. Paid QuickDine plans aap set karenge. Offline received subscription payment central admin record kar sakta hai. Razorpay secrets/webhook connect hone par one-time online renewals enable karein.
7. Live deployed website se QR generate karein. Demo/localhost QR real restaurant mein use na karein.

Review build functional hai; real Firebase project deployment, merchant activation aur actual restaurant pilot abhi external setup hain. Domain baad mein kharid sakte hain. Voice, delivery, refunds aur recurring automatic debit is release mein nahi hain.
