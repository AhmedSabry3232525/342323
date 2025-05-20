const firebaseConfig = {
            apiKey: "AIzaSyDF0ZN5SY_r4CCaXT06qK75BdEMDudR9y8",
            authDomain: "project-2698220189460482777.firebaseapp.com",
            projectId: "project-2698220189460482777",
            storageBucket: "project-2698220189460482777.firebasestorage.app",
            messagingSenderId: "788721239859",
            appId: "1:788721239859:web:795314fc01c8a476cb6046"
        };

        // Editable variable for unlisted playlist IDs
        const unlistedPlaylistIds = [
            "PLWbkez45-Hjc0Gfsuhi6O8FLvix3x-2Ms",
            "PLWbkez45-Hjct9o7Mf_iPdR-K4Q7kDdll",
            "PLWbkez45-HjdKW83h04VOZzcnkrEV906x",
            "PLWbkez45-HjelaYTDMiaWqfsY0CLg5zXI",
            "PLWbkez45-HjeKaNhRX6PKCdG1qV8CTZoQ",
            "PLWbkez45-Hjdmkh0Yv1VQRTxUqvmflDdg",
            "PLWbkez45-HjdByOutkv9GIALbaqMNkf8Y",
            "PLWbkez45-Hjc0RZmCqmRYzDdQ_57U1y2z",
            "PLWbkez45-Hje2LcvrpPhki_d_eGc_AnSf",
            "PLWbkez45-HjcxHZ9Um0eRXhXyNTgk-C_S",
            "PLWbkez45-HjcLmPFM85gED0WBFS6NVkT8",
            "PLWbkez45-Hjd9nxjm8N0WLou4RGgiYCqY",
            "PLWbkez45-HjdNvqW2RBuqmDfxDG-jTrrM",
            "PLWbkez45-HjcttmAkqKSrHiFDwvxqCqPw",
            "PLWbkez45-HjdRgf79NSG6Z5SrrDbLH0kV",
            "PLWbkez45-HjcxTvEMyVwbT6vJmIHkDuPA",
            "PLWbkez45-HjcxTvEMyVwbT6vJmIHkDuPA",
            "PLWbkez45-HjfkmPRM8CKLmYroiCTxHOvU",
            "PLWbkez45-Hjd3O296v2LYXjKyckta3Q82",
            "PLWbkez45-HjdDsXfZ0a2n8t6LjlvzJI_I"
        ];

        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();

        // Enable auth persistence
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);