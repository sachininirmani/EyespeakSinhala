export const wijesekara= {
    id: "wijesekara",
    label: "Helakuru Smart Wijesekara",
    columns: 11,
    hasVowelPopup: false,

    // Primary + Secondary mapping for keys that have two letters
    primarySecondaryMap: {
        "ු": " ්‍ර",
        "හ": "ඥ",
        "ද": "ඳ",
        "්": "!",
        "ක": "ඤ",
        "ං": "ඃ",
        "ජ": "ඦ",
        "ඩ": "ඬ",
        "ග": "ඟ",
    },

    firstStageLetters: [
        ["ු", "අ", "ැ", "ර", "එ", "හ", "ම", "ස", "ද", "ච"],
        ["්", "ි", "ා", "ෙ", "ට", "ය", "ව", "න", "ක", "ත"],
        ["ං", "ජ", "ඩ", "ඉ", "බ", "ප", "ල", "ග"]
    ],

    secondStageLetters: [
        ["ූ", "උ", "ෑ", "ඍ", "ඔ", "ශ", "ඹ", "ෂ", "ධ", "ඡ"],
        ["ෟ", "ී", "ෘ", "ෆ", "ඨ", "්‍ය", "ළු", "ණ", "ඛ", "ථ"],
        ["ඞ", "ඣ", "ඪ", "ඊ", "භ", "ඵ", "ළ", "ඝ"]
    ]
};
