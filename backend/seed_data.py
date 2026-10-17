U = "https://images.unsplash.com/photo-{}?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200"
P = "https://images.pexels.com/photos/{0}/pexels-photo-{0}.{1}?auto=compress&cs=tinysrgb&w=1200"

IMAGES = {
    "sofa1": U.format("1779144639439-00e6d853fd6f"), "sofa2": U.format("1759722668253-1767030ad9b2"),
    "sofa3": U.format("1667584523543-d1d9cc828a15"), "sofa4": U.format("1759722667079-1a4e23d9ead9"),
    "bed1": U.format("1757344454333-cc666252e596"), "bed2": U.format("1750420556288-d0e32a6f517b"),
    "bed3": U.format("1517862774645-dd398fbfaffa"), "bed4": P.format("27638174", "jpeg"), "bed5": U.format("1631048499455-4f9e26f23b9f"),
    "din1": U.format("1758977403341-0104135995af"), "din2": U.format("1590938401285-eba3a552ece4"),
    "din3": U.format("1581970696275-253e75ecf269"), "din4": U.format("1547062200-f195b1c77e30"),
    "ward1": U.format("1672137233327-37b0c1049e77"), "ward2": P.format("7061419", "jpeg"),
    "ward3": P.format("32331030", "png"), "ward4": U.format("1618236444721-4a8dba415c15"),
    "off1": U.format("1688578735427-994ecdea3ea4"), "off2": U.format("1612372606404-0ab33e7187ee"),
    "off3": U.format("1657757996603-acec063f1d9b"), "off4": P.format("5483245", "jpeg"),
    "stor1": U.format("1594580701468-e5678582b8ce"), "stor2": U.format("1653971858625-9cb23d0dca80"),
    "stor3": U.format("1628843201283-2ca32147ad3e"), "stor4": U.format("1532588213355-52317771cce6"),
    "mat1": U.format("1691491666870-d5056025e5e9"), "mat2": U.format("1759176170553-7c078c66c514"),
    "mat3": U.format("1647376036543-f9f543601a1d"), "mat4": U.format("1772476361154-e894ba10d757"),
    "study1": P.format("6265942", "jpeg"), "study2": P.format("928804", "jpeg"),
    "study3": U.format("1519219788971-8d9797e0928e"), "study4": U.format("1570974802254-4b0ad1a755f5"),
    "decor1": U.format("1525211867-7658f3b4f9a2"), "decor2": U.format("1784466505230-9c86a1717509"),
    "decor3": U.format("1544207240-8b1025eb7aeb"), "decor4": U.format("1573676386604-78f8ed228e2b"),
    "out1": U.format("1533391120950-2d65c72e5969"), "out2": U.format("1613685302957-3a6fc45346ef"),
    "out3": U.format("1621506821957-1b50ab7787a4"), "out4": P.format("27204128", "jpeg"), "out5": P.format("2752917", "jpeg"),
    "banner1": P.format("8082229", "jpeg"), "banner2": P.format("39829559", "jpeg"),
}


def img(k):
    return f"/api/uploads/seed/{k}.jpg"


CATEGORIES = [
    ("sofa", "Sofa", "सोफा", "Sofa", "sofa3", "living"),
    ("bed", "Bed", "बेड", "BedDouble", "bed1", "bedroom"),
    ("dining", "Dining", "डायनिंग", "UtensilsCrossed", "din1", "dining"),
    ("wardrobe", "Wardrobe", "वॉर्डरोब", "DoorClosed", "ward2", "bedroom"),
    ("office", "Office", "ऑफिस", "Briefcase", "off1", "office"),
    ("storage", "Storage", "स्टोरेज", "Archive", "stor2", "living"),
    ("mattress", "Mattress", "गादी", "BedSingle", "mat2", "bedroom"),
    ("study-table", "Study Table", "स्टडी टेबल", "BookOpen", "study1", "kids"),
    ("decor", "Decor", "सजावट", "Lamp", "decor2", "living"),
    ("outdoor", "Outdoor", "आउटडोअर", "TreePine", "out3", "outdoor"),
]

# (cat, name, name_mr, brand, material, color, price, mrp, stock, images)
PRODUCTS = [
    ("sofa", "Royal Teak 3 Seater Sofa", "रॉयल सागवान ३ सीटर सोफा", "Mauli Craft", "Solid Wood", "Brown", 32999, 49999, 12, ["sofa1", "sofa3"]),
    ("sofa", "Milano L-Shape Sectional Sofa", "मिलानो एल-शेप सोफा", "Urban Nest", "Fabric", "Grey", 54999, 79999, 6, ["sofa2", "sofa4"]),
    ("sofa", "Shivneri Leather Recliner", "शिवनेरी लेदर रिक्लायनर", "ComfortPlus", "Leather", "Brown", 27499, 38999, 3, ["sofa1"]),
    ("sofa", "Sahyadri Sofa Cum Bed", "सह्याद्री सोफा कम बेड", "Urban Nest", "Fabric", "Grey", 18999, 26999, 9, ["sofa4", "sofa2"]),
    ("sofa", "Peshwa Wooden Diwan", "पेशवा लाकडी दिवाण", "Mauli Craft", "Sheesham Wood", "Brown", 15999, 22999, 7, ["sofa3"]),
    ("sofa", "Chesterfield 2 Seater Sofa", "चेस्टरफील्ड २ सीटर सोफा", "ComfortPlus", "Fabric", "Grey", 21999, 29999, 0, ["sofa2"]),
    ("bed", "Rajgad King Size Storage Bed", "राजगड किंग साइज स्टोरेज बेड", "Mauli Craft", "Sheesham Wood", "Brown", 38999, 56999, 8, ["bed1", "bed2"]),
    ("bed", "Pune Queen Bed", "पुणे क्वीन बेड", "HomeLine", "Engineered Wood", "Walnut", 21999, 32999, 14, ["bed2"]),
    ("bed", "Kolhapuri Carved Wooden Bed", "कोल्हापुरी कोरीव लाकडी बेड", "Mauli Craft", "Solid Wood", "Honey", 45999, 64999, 4, ["bed4"]),
    ("bed", "Nashik Single Bed", "नाशिक सिंगल बेड", "HomeLine", "Engineered Wood", "White", 11999, 16999, 2, ["bed3"]),
    ("bed", "Hydraulic Storage Double Bed", "हायड्रॉलिक स्टोरेज डबल बेड", "Urban Nest", "Engineered Wood", "Walnut", 29999, 42999, 10, ["bed2", "bed1"]),
    ("dining", "Annapurna 6 Seater Dining Set", "अन्नपूर्णा ६ सीटर डायनिंग सेट", "Mauli Craft", "Sheesham Wood", "Brown", 42999, 59999, 5, ["din1"]),
    ("dining", "Konkan 4 Seater Dining Set", "कोकण ४ सीटर डायनिंग सेट", "HomeLine", "Solid Wood", "Black", 24999, 34999, 11, ["din2", "din4"]),
    ("dining", "Wicker Charm Dining Set", "विकर डायनिंग सेट", "Urban Nest", "Cane", "Natural", 31999, 44999, 6, ["din3"]),
    ("dining", "Marble Top Dining Table", "मार्बल टॉप डायनिंग टेबल", "ComfortPlus", "Marble", "Black", 36999, 52999, 3, ["din4"]),
    ("wardrobe", "Sahyadri 3 Door Mirror Wardrobe", "सह्याद्री ३ दरवाजा आरसा वॉर्डरोब", "HomeLine", "Engineered Wood", "Beige", 26999, 38999, 7, ["ward1"]),
    ("wardrobe", "Sliding Door Wardrobe", "स्लायडिंग डोअर वॉर्डरोब", "Urban Nest", "Engineered Wood", "Grey", 34999, 49999, 4, ["ward3"]),
    ("wardrobe", "Teak 2 Door Almirah", "सागवान २ दरवाजा कपाट", "Mauli Craft", "Solid Wood", "Brown", 22999, 31999, 9, ["ward2"]),
    ("wardrobe", "Open Shelf Wardrobe Unit", "ओपन शेल्फ वॉर्डरोब", "HomeLine", "Engineered Wood", "White", 14999, 19999, 1, ["ward4"]),
    ("office", "ErgoMax Mesh Office Chair", "एर्गोमॅक्स मेश ऑफिस खुर्ची", "ComfortPlus", "Mesh", "Grey", 8999, 14999, 25, ["off1", "off3"]),
    ("office", "Executive Leather Chair", "एक्झिक्युटिव्ह लेदर खुर्ची", "ComfortPlus", "Leather", "Brown", 12499, 18999, 15, ["off2"]),
    ("office", "Workstation Desk 4ft", "वर्कस्टेशन डेस्क ४ फूट", "HomeLine", "Engineered Wood", "White", 9999, 14999, 18, ["off4", "off3"]),
    ("office", "Manager Office Table", "मॅनेजर ऑफिस टेबल", "Mauli Craft", "Engineered Wood", "Walnut", 17999, 25999, 6, ["off3"]),
    ("storage", "Chest of 6 Drawers", "६ ड्रॉवर चेस्ट", "Mauli Craft", "Solid Wood", "Natural", 15999, 22999, 8, ["stor2"]),
    ("storage", "Shoe Rack Cabinet", "शू रॅक कॅबिनेट", "HomeLine", "Engineered Wood", "Natural", 5999, 8999, 20, ["stor4"]),
    ("storage", "TV Unit Sideboard", "टीव्ही युनिट साइडबोर्ड", "Urban Nest", "Engineered Wood", "Walnut", 13999, 19999, 9, ["stor1"]),
    ("storage", "Bookshelf Cabinet", "बुकशेल्फ कॅबिनेट", "Mauli Craft", "Solid Wood", "Honey", 11999, 16999, 5, ["stor3"]),
    ("mattress", "Sukhnidra Orthopedic Mattress", "सुखनिद्रा ऑर्थोपेडिक गादी", "Sukhnidra", "Memory Foam", "White", 14999, 22999, 30, ["mat2", "mat3"]),
    ("mattress", "Pocket Spring King Mattress", "पॉकेट स्प्रिंग किंग गादी", "Sukhnidra", "Spring", "White", 21999, 32999, 12, ["mat3"]),
    ("mattress", "Traditional Cotton Gadda", "पारंपरिक कापसाची गादी", "Mauli Craft", "Cotton", "White", 4999, 6999, 40, ["mat1"]),
    ("mattress", "Dual Comfort Foam Mattress", "ड्युअल कम्फर्ट फोम गादी", "Sukhnidra", "Foam", "White", 9999, 14999, 22, ["mat4", "mat2"]),
    ("study-table", "Vidya Study Table with Shelf", "विद्या स्टडी टेबल (शेल्फसह)", "HomeLine", "Engineered Wood", "Natural", 6999, 9999, 16, ["study3"]),
    ("study-table", "Classic Writing Desk", "क्लासिक रायटिंग डेस्क", "Mauli Craft", "Solid Wood", "Cream", 12999, 18999, 5, ["study1"]),
    ("study-table", "Laptop Study Desk", "लॅपटॉप स्टडी डेस्क", "Urban Nest", "Engineered Wood", "Walnut", 4999, 7499, 21, ["study2"]),
    ("study-table", "Kids Study Table & Chair", "मुलांसाठी स्टडी टेबल व खुर्ची", "HomeLine", "Engineered Wood", "White", 5499, 7999, 3, ["study4"]),
    ("decor", "Brass Table Lamp", "पितळी टेबल लॅम्प", "Kalakriti", "Brass", "Gold", 2499, 3999, 35, ["decor2"]),
    ("decor", "Ceramic Lamp", "सिरॅमिक लॅम्प", "Kalakriti", "Ceramic", "Black", 1999, 2999, 28, ["decor4"]),
    ("decor", "Glass Vase & Planter Set", "काचेचा फ्लॉवर पॉट सेट", "Kalakriti", "Glass", "Transparent", 1499, 2499, 45, ["decor1"]),
    ("decor", "Tripod Floor Lamp", "ट्रायपॉड फ्लोअर लॅम्प", "Kalakriti", "Wood", "White", 3499, 5499, 12, ["decor3"]),
    ("outdoor", "Garden Bistro Set", "गार्डन बिस्ट्रो सेट", "OutdoorPro", "Metal", "White", 8999, 12999, 10, ["out1"]),
    ("outdoor", "Teak Patio Lounge Set", "सागवान पॅटिओ लाउंज सेट", "OutdoorPro", "Teak", "Natural", 49999, 69999, 3, ["out3", "out2"]),
    ("outdoor", "Balcony Wooden Table Set", "बाल्कनी लाकडी टेबल सेट", "Mauli Craft", "Solid Wood", "Natural", 11999, 16999, 8, ["out4"]),
    ("outdoor", "Terrace Sofa Set", "टेरेस सोफा सेट", "OutdoorPro", "Wood", "Beige", 39999, 56999, 4, ["out2"]),
    ("outdoor", "Vintage Metal Cafe Chairs (Set of 2)", "व्हिंटेज मेटल खुर्ची (२ नग)", "OutdoorPro", "Metal", "Black", 6999, 9999, 14, ["out5"]),
]

DIMENSIONS = {
    "sofa": "W 210 x D 85 x H 90 cm", "bed": "L 208 x W 158 x H 95 cm", "dining": "Table L 150 x W 90 x H 76 cm",
    "wardrobe": "W 120 x D 55 x H 200 cm", "office": "W 65 x D 65 x H 110-120 cm", "storage": "W 90 x D 40 x H 85 cm",
    "mattress": "72 x 60 x 6 inch", "study-table": "W 100 x D 50 x H 75 cm", "decor": "H 45-150 cm", "outdoor": "Table dia 60 cm, Chair H 80 cm",
}

BLOGS = [
    ("small-living-room-ideas", "7 Ideas to Make a Small Living Room Look Bigger", "लहान लिव्हिंग रूम मोठी दिसण्यासाठी ७ कल्पना", "sofa3",
     "Choose light colours, multi-purpose furniture like sofa-cum-beds, wall-mounted shelves and mirrors. Keep walkways clear and use one statement piece instead of many small items."),
    ("choose-right-mattress", "How to Choose the Right Mattress", "योग्य गादी कशी निवडावी", "mat2",
     "Back sleepers do well on medium-firm orthopedic mattresses, side sleepers need softer memory foam. Check trial period, warranty and size (72x60 for queen, 78x72 for king)."),
    ("sheesham-vs-engineered-wood", "Sheesham vs Engineered Wood: Which to Buy?", "शिसम की इंजिनिअर्ड वुड: काय घ्यावे?", "bed1",
     "Sheesham (solid wood) lasts decades and can be re-polished; engineered wood is lighter, budget friendly and great for modern designs. For beds and dining, solid wood is a long-term investment."),
]


def legal_pages(s):
    shop, addr, ph, em = s['shop_name'], s['address'], s['phone'], s['email']
    contact = f"{shop}, {addr}. Phone: {ph}. Email: {em}."
    return [
        ("about", "About Us", "आमच्याबद्दल", f"{shop} (माऊली फर्निचर मॉल) is a family-run furniture showroom in {addr}. For years we have helped families across Maharashtra furnish their homes with quality sofas, beds, dining sets, wardrobes and mattresses at honest prices.\n\nWhy choose us:\n- Large showroom with 500+ designs on display\n- Solid wood and engineered wood options for every budget\n- Free installation on most furniture\n- Easy EMI and secure online payments\n- Local after-sales support\n\nVisit our showroom from {s['timings']}."),
        ("contact", "Contact Us", "संपर्क", f"We are happy to help!\n\n{contact}\nWhatsApp: {s['whatsapp']}\nShowroom timings: {s['timings']}\nGSTIN: {s['gst_number']}\n\nFor order support, please keep your Order ID ready."),
        ("privacy", "Privacy Policy", "गोपनीयता धोरण", f"Last updated: [DATE]\n\nThis Privacy Policy explains how {shop} (\"we\", \"us\") collects, uses and protects your information when you use our website and mobile app.\n\n1. Information we collect\n- Name, phone number, email address and delivery addresses you provide.\n- Order history, wishlist and reviews.\n- Device information, app usage data and push notification tokens.\n- Payment information is processed securely by Razorpay; we do not store card or UPI details.\n\n2. How we use your information\n- To process and deliver orders, provide invoices and support.\n- To send order updates by SMS, WhatsApp, email and push notifications.\n- To improve our products and services and prevent fraud.\n\n3. Sharing\nWe share data only with delivery partners, payment gateways and service providers needed to fulfil your order, or when required by law. We never sell your data.\n\n4. Data retention and deletion\nYou can delete your account anytime from Account > Delete Account in the app. We delete your personal data within 30 days, except records we must keep for tax/legal purposes (GST invoices).\n\n5. Security\nWe use HTTPS encryption, hashed passwords and role-based access controls.\n\n6. Children\nOur services are not directed to children under 13.\n\n7. Contact\n{contact}"),
        ("terms", "Terms & Conditions", "नियम व अटी", f"By using the {shop} website or app you agree to these terms.\n\n1. Products and prices: All prices are in Indian Rupees and inclusive of GST unless stated. Product colours may vary slightly due to photography and wood grain.\n2. Orders: An order is confirmed after successful payment or COD confirmation. We may cancel orders due to stock or pricing errors with a full refund.\n3. Payments: Online payments are processed by Razorpay. Cash on Delivery and Pay at Store are available for eligible orders.\n4. Delivery and installation: Delivery timelines are estimates. Free installation is provided where mentioned.\n5. Warranty: Warranty is as mentioned on each product page and covers manufacturing defects only.\n6. User conduct: Do not misuse the platform, post fake reviews or attempt unauthorised access.\n7. Liability: Our liability is limited to the value of the product purchased.\n8. Governing law: These terms are governed by the laws of India; courts in Pune, Maharashtra have jurisdiction.\n\nContact: {contact}"),
        ("refund", "Return & Refund Policy", "परतावा धोरण", f"1. Returns: Furniture can be returned within 7 days of delivery if it is damaged, defective or different from what was ordered. Please raise a request from My Orders with photos.\n2. Replacement: Damaged parts or products are replaced free of cost after inspection.\n3. Non-returnable: Custom-made furniture, mattresses once unwrapped (unless defective), and clearance items.\n4. Cancellation: Orders can be cancelled free of cost before they are shipped.\n5. Refunds: Approved refunds are processed to the original payment method within 5-7 working days. COD refunds are made by bank transfer/UPI.\n\nContact: {contact}"),
        ("shipping", "Shipping & Delivery Policy", "शिपिंग धोरण", f"1. We deliver across Maharashtra and selected cities in India. Check delivery availability using the pincode checker on each product page.\n2. Delivery time: Usually 2-7 working days depending on your pincode and product availability.\n3. Delivery charges: Shown at checkout based on pincode. Free delivery on orders above the free-delivery limit.\n4. Delivery slots: You can choose a preferred delivery slot at checkout.\n5. Installation: Our team installs furniture at the time of delivery where free installation is mentioned.\n6. Pick up at showroom: Choose \"Pay at store / Reserve & pick up\" to collect from our showroom at {addr}.\n\nContact: {contact}"),
    ]
