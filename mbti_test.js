// mbti_test.js

const questions = [
  { id: 1, dimension: "EI", question: "در جمع‌های جدید معمولاً:", option_a: "راحت‌تر سر صحبت را باز می‌کنم", option_b: "بیشتر صبر می‌کنم تا فضا را بسنجم", score_a: "E", score_b: "I" },
  { id: 2, dimension: "EI", question: "بعد از یک روز شلوغ، برای بازیابی انرژی:", option_a: "دوست دارم با کسی صحبت کنم یا بیرون بروم", option_b: "ترجیح می‌دهم تنها باشم", score_a: "E", score_b: "I" },
  { id: 3, dimension: "EI", question: "در جلسات یا کلاس‌ها:", option_a: "معمولاً بلند فکر می‌کنم و نظر می‌دهم", option_b: "اول در ذهنم جمع‌بندی می‌کنم بعد حرف می‌زنم", score_a: "E", score_b: "I" },
  { id: 4, dimension: "EI", question: "وقتی هیجان‌زده می‌شوم:", option_a: "احساسم را سریع بروز می‌دهم", option_b: "بیشتر درون خودم نگه می‌دارم", score_a: "E", score_b: "I" },
  { id: 5, dimension: "EI", question: "در کار گروهی:", option_a: "تعامل مداوم با دیگران به من انرژی می‌دهد", option_b: "اگر مستقل کار کنم بهتر تمرکز می‌کنم", score_a: "E", score_b: "I" },
  { id: 6, dimension: "EI", question: "در مهمانی:", option_a: "با افراد مختلف ارتباط می‌گیرم", option_b: "با چند نفر محدود راحت‌ترم", score_a: "E", score_b: "I" },
  { id: 7, dimension: "EI", question: "وقتی مسئله‌ای دارید:", option_a: "با حرف زدن بهتر به نتیجه می‌رسم", option_b: "با فکر کردن در تنهایی بهتر نتیجه می‌گیرم", score_a: "E", score_b: "I" },
  { id: 8, dimension: "EI", question: "معمولاً دیگران شما را:", option_a: "برون‌گراتر و در دسترس‌تر می‌بینند", option_b: "آرام‌تر و درون‌گراتر می‌بینند", score_a: "E", score_b: "I" },
  { id: 9, dimension: "EI", question: "اگر آخر هفته آزاد باشید:", option_a: "ترجیح می‌دهم برنامه اجتماعی داشته باشم", option_b: "ترجیح می‌دهم زمان شخصی داشته باشم", score_a: "E", score_b: "I" },
  { id: 10, dimension: "EI", question: "در تصمیم‌گیری فوری:", option_a: "زود واکنش نشان می‌دهم", option_b: "کمی مکث می‌کنم و بعد پاسخ می‌دهم", score_a: "E", score_b: "I" },
  { id: 11, dimension: "EI", question: "وقتی با فرد جدید آشنا می‌شوید:", option_a: "راحت‌تر گفت‌وگو را ادامه می‌دهم", option_b: "اگر طرف مقابل جلو بیاید راحت‌ترم", score_a: "E", score_b: "I" },
  { id: 12, dimension: "EI", question: "در محیط کاری:", option_a: "فضای پرتعامل را ترجیح می‌دهم", option_b: "فضای آرام و کم‌حاشیه را ترجیح می‌دهم", score_a: "E", score_b: "I" },
  { id: 13, dimension: "EI", question: "هنگام تعریف اتفاقات روز:", option_a: "با جزئیات و هیجان برای دیگران تعریف می‌کنم", option_b: "فقط اگر لازم باشد تعریف می‌کنم", score_a: "E", score_b: "I" },
  { id: 14, dimension: "EI", question: "اگر چند ساعت تنها بمانید:", option_a: "احتمالاً دلم تعامل می‌خواهد", option_b: "معمولاً مشکلی ندارم و حتی لذت می‌برم", score_a: "E", score_b: "I" },
  { id: 15, dimension: "EI", question: "در شروع کار جدید:", option_a: "دوست دارم با افراد درگیر شوم و جلو بروم", option_b: "اول می‌خواهم ساختار را برای خودم بفهمم", score_a: "E", score_b: "I" },

  { id: 16, dimension: "SN", question: "بیشتر به چه چیزی توجه می‌کنید؟", option_a: "واقعیت‌ها و آنچه اکنون هست", option_b: "الگوها و آنچه می‌تواند باشد", score_a: "S", score_b: "N" },
  { id: 17, dimension: "SN", question: "هنگام یادگیری موضوع جدید:", option_a: "مثال‌های واقعی کمکم می‌کند", option_b: "مفهوم کلی و ایده اصلی مهم‌تر است", score_a: "S", score_b: "N" },
  { id: 18, dimension: "SN", question: "در توضیح دادن موضوعات:", option_a: "جزئیات و مرحله‌ها را می‌گویم", option_b: "تصویر کلی و ارتباط‌ها را توضیح می‌دهم", score_a: "S", score_b: "N" },
  { id: 19, dimension: "SN", question: "معمولاً بیشتر به:", option_a: "تجربه‌های عملی اعتماد دارم", option_b: "الهام‌ها و بینش‌ها اعتماد دارم", score_a: "S", score_b: "N" },
  { id: 20, dimension: "SN", question: "در گفتگوها:", option_a: "موضوعات مشخص و واقعی را ترجیح می‌دهم", option_b: "ایده‌ها و فرضیه‌ها برایم جذاب‌ترند", score_a: "S", score_b: "N" },
  { id: 21, dimension: "SN", question: "اگر بخواهید پروژه‌ای را شروع کنید:", option_a: "اول منابع و شرایط واقعی را بررسی می‌کنم", option_b: "اول چشم‌انداز و امکان‌هایش را می‌بینم", score_a: "S", score_b: "N" },
  { id: 22, dimension: "SN", question: "بیشتر جذب چه چیزی می‌شوید؟", option_a: "چیزهای ملموس و کاربردی", option_b: "مفاهیم تازه و آینده‌نگر", score_a: "S", score_b: "N" },
  { id: 23, dimension: "SN", question: "در حل مسئله:", option_a: "از روش‌های امتحان‌شده استفاده می‌کنم", option_b: "راه‌های تازه را امتحان می‌کنم", score_a: "S", score_b: "N" },
  { id: 24, dimension: "SN", question: "وقتی کسی حرف می‌زند:", option_a: "به آنچه دقیقاً گفته می‌شود توجه می‌کنم", option_b: "بین خطوط و منظور پشت حرف‌ها را می‌فهمم", score_a: "S", score_b: "N" },
  { id: 25, dimension: "SN", question: "برای شما کدام مهم‌تر است؟", option_a: "کاربردی بودن", option_b: "نو بودن", score_a: "S", score_b: "N" },
  { id: 26, dimension: "SN", question: "در برنامه‌ریزی:", option_a: "به داده‌های واقعی تکیه می‌کنم", option_b: "به احتمالات آینده فکر می‌کنم", score_a: "S", score_b: "N" },
  { id: 27, dimension: "SN", question: "بیشتر ذهن شما:", option_a: "روی اکنون و واقعیت است", option_b: "روی آینده و امکان‌هاست", score_a: "S", score_b: "N" },
  { id: 28, dimension: "SN", question: "اگر بخواهید چیزی را به خاطر بسپارید:", option_a: "جزئیات واقعی را بهتر به یاد می‌سپارم", option_b: "برداشت کلی و معنا را بهتر به خاطر می‌سپارم", score_a: "S", score_b: "N" },
  { id: 29, dimension: "SN", question: "در انتخاب‌ها:", option_a: "چیزی که امتحانش را پس داده ترجیح می‌دهم", option_b: "چیزی که پتانسیل بیشتری دارد ترجیح می‌دهم", score_a: "S", score_b: "N" },
  { id: 30, dimension: "SN", question: "وقتی با موضوع پیچیده روبه‌رو می‌شوید:", option_a: "آن را به واقعیت‌های قابل بررسی می‌شکنم", option_b: "الگوی پنهان آن را پیدا می‌کنم", score_a: "S", score_b: "N" },

  { id: 31, dimension: "TF", question: "هنگام تصمیم‌گیری بیشتر:", option_a: "منطق و انصاف را معیار قرار می‌دهم", option_b: "تأثیر تصمیم بر آدم‌ها را معیار قرار می‌دهم", score_a: "T", score_b: "F" },
  { id: 32, dimension: "TF", question: "اگر لازم باشد بازخورد بدهید:", option_a: "صریح و مستقیم می‌گویم", option_b: "طوری می‌گویم که طرف مقابل کمتر ناراحت شود", score_a: "T", score_b: "F" },
  { id: 33, dimension: "TF", question: "در اختلاف‌ها:", option_a: "اول دنبال حقیقت و منطق هستم", option_b: "اول دنبال حفظ رابطه و درک احساسات هستم", score_a: "T", score_b: "F" },
  { id: 34, dimension: "TF", question: "دیگران شما را بیشتر:", option_a: "منطقی و بی‌طرف", option_b: "همدل و ملاحظه‌گر", score_a: "T", score_b: "F" },
  { id: 35, dimension: "TF", question: "برای قضاوت درباره یک تصمیم:", option_a: "درست بودنش مهم‌تر است", option_b: "انسانی بودنش مهم‌تر است", score_a: "T", score_b: "F" },
  { id: 36, dimension: "TF", question: "در کار تیمی:", option_a: "کارآمدی و نتیجه اولویت دارد", option_b: "هماهنگی و رضایت افراد هم مهم است", score_a: "T", score_b: "F" },
  { id: 37, dimension: "TF", question: "وقتی کسی ناراحت است:", option_a: "سعی می‌کنم راه‌حل بدهم", option_b: "اول سعی می‌کنم احساسش را درک کنم", score_a: "T", score_b: "F" },
  { id: 38, dimension: "TF", question: "در تصمیم‌های مهم:", option_a: "احساسات نباید در منطق دخالت کنند", option_b: "احساسات اطلاعات مهمی می‌دهند", score_a: "T", score_b: "F" },
  { id: 39, dimension: "TF", question: "در مواجهه با اشتباه دیگران:", option_a: "اشتباه را واضح می‌گویم", option_b: "نحوه بیان را با حساسیت بیشتری انتخاب می‌کنم", score_a: "T", score_b: "F" },
  { id: 40, dimension: "TF", question: "اگر دو گزینه برابر باشند:", option_a: "گزینه منطقی‌تر را انتخاب می‌کنم", option_b: "گزینه‌ای را انتخاب می‌کنم که با ارزش‌هایم هماهنگ‌تر باشد", score_a: "T", score_b: "F" },
  { id: 41, dimension: "TF", question: "وقتی بحثی پیش می‌آید:", option_a: "تحلیل استدلال‌ها برایم مهم‌تر است", option_b: "لحن و احساسات افراد برایم مهم‌تر است", score_a: "T", score_b: "F" },
  { id: 42, dimension: "TF", question: "در رهبری:", option_a: "شفافیت، قانون و کارایی مهم‌تر است", option_b: "انگیزه دادن و توجه به آدم‌ها مهم‌تر است", score_a: "T", score_b: "F" },
  { id: 43, dimension: "TF", question: "وقتی کسی از شما مشورت می‌خواهد:", option_a: "واقع‌بینانه و تحلیلی پاسخ می‌دهم", option_b: "همدلانه و حمایتی پاسخ می‌دهم", score_a: "T", score_b: "F" },
  { id: 44, dimension: "TF", question: "برای شما کدام ارزشمندتر است؟", option_a: "عدالت", option_b: "مهربانی", score_a: "T", score_b: "F" },
  { id: 45, dimension: "TF", question: "اگر لازم باشد تصمیم سختی بگیرید:", option_a: "احتمالاً قاطع‌تر عمل می‌کنم", option_b: "به اثر احساسی آن بیشتر فکر می‌کنم", score_a: "T", score_b: "F" },

  { id: 46, dimension: "JP", question: "در زندگی روزمره:", option_a: "برنامه داشتن را دوست دارم", option_b: "انعطاف داشتن را ترجیح می‌دهم", score_a: "J", score_b: "P" },
  { id: 47, dimension: "JP", question: "وقتی سفری در پیش دارید:", option_a: "از قبل برنامه‌ریزی می‌کنم", option_b: "در مسیر تصمیم می‌گیرم", score_a: "J", score_b: "P" },
  { id: 48, dimension: "JP", question: "در انجام کارها:", option_a: "دوست دارم زودتر به نتیجه برسم", option_b: "دوست دارم گزینه‌ها باز بماند", score_a: "J", score_b: "P" },
  { id: 49, dimension: "JP", question: "میز کار یا فضای ذهنی شما معمولاً:", option_a: "ساختارمندتر و مرتب‌تر است", option_b: "آزادتر و شناورتر است", score_a: "J", score_b: "P" },
  { id: 50, dimension: "JP", question: "ددلاین‌ها برای شما:", option_a: "کمک می‌کنند زودتر جمع‌بندی کنم", option_b: "اغلب تا نزدیک موعد صبر می‌کنم", score_a: "J", score_b: "P" },
  { id: 51, dimension: "JP", question: "وقتی تصمیمی می‌گیرید:", option_a: "دوست دارم نهایی‌اش کنم", option_b: "ممکن است دوباره بررسی‌اش کنم", score_a: "J", score_b: "P" },
  { id: 52, dimension: "JP", question: "در برنامه روزانه:", option_a: "داشتن چارچوب به من آرامش می‌دهد", option_b: "آزادی عمل به من آرامش می‌دهد", score_a: "J", score_b: "P" },
  { id: 53, dimension: "JP", question: "اگر کاری نیمه‌تمام بماند:", option_a: "معمولاً اذیتم می‌کند", option_b: "خیلی برایم مسئله نیست", score_a: "J", score_b: "P" },
  { id: 54, dimension: "JP", question: "در مواجهه با تغییر ناگهانی:", option_a: "ترجیح می‌دهم کمتر رخ دهد", option_b: "اغلب می‌توانم خودم را وفق بدهم", score_a: "J", score_b: "P" },
  { id: 55, dimension: "JP", question: "بیشتر دوست دارید:", option_a: "کارها مشخص و زمان‌بندی‌شده باشند", option_b: "کارها باز و قابل تغییر باشند", score_a: "J", score_b: "P" },
  { id: 56, dimension: "JP", question: "در خرید یا انتخاب:", option_a: "زودتر تصمیم می‌گیرم و تمام", option_b: "گزینه‌ها را بیشتر نگه می‌دارم", score_a: "J", score_b: "P" },
  { id: 57, dimension: "JP", question: "در پروژه‌ها:", option_a: "چک‌لیست و ساختار را ترجیح می‌دهم", option_b: "انعطاف و بداهه را ترجیح می‌دهم", score_a: "J", score_b: "P" },
  { id: 58, dimension: "JP", question: "وقتی قرار یا برنامه‌ای دارید:", option_a: "دوست دارم از قبل مشخص باشد", option_b: "اگر در لحظه هماهنگ شود هم مشکلی نیست", score_a: "J", score_b: "P" },
  { id: 59, dimension: "JP", question: "برای شما کدام خوشایندتر است؟", option_a: "نظم", option_b: "آزادی", score_a: "J", score_b: "P" },
  { id: 60, dimension: "JP", question: "در سبک زندگی:", option_a: "جمع‌بندی و قطعیت را دوست دارم", option_b: "باز بودن و امکان تغییر را دوست دارم", score_a: "J", score_b: "P" }
];

const tieBreakers = {
  EI: {
    id: "tie_EI",
    dimension: "EI",
    question: "وقتی نیاز به بازیابی انرژی دارید، ترجیح می‌دهید:",
    option_a: "با دیگران وقت بگذرانم",
    option_b: "در تنهایی و سکوت باشم",
    score_a: "E",
    score_b: "I"
  },
  SN: {
    id: "tie_SN",
    dimension: "SN",
    question: "وقتی با یک موضوع جدید روبه‌رو می‌شوید، بیشتر:",
    option_a: "روی واقعیت‌ها و جزئیات آن تمرکز می‌کنم",
    option_b: "روی معنا، الگو و امکان‌های آن تمرکز می‌کنم",
    score_a: "S",
    score_b: "N"
  },
  TF: {
    id: "tie_TF",
    dimension: "TF",
    question: "وقتی باید بین دو گزینه یکی را انتخاب کنید، بیشتر:",
    option_a: "سراغ منطقی‌ترین انتخاب می‌روم",
    option_b: "سراغ انتخابی می‌روم که با ارزش‌ها و احساساتم سازگارتر باشد",
    score_a: "T",
    score_b: "F"
  },
  JP: {
    id: "tie_JP",
    dimension: "JP",
    question: "وقتی با یک کار مهم روبه‌رو می‌شوید:",
    option_a: "می‌خواهم سریع ساختار و برنامه‌اش مشخص شود",
    option_b: "می‌خواهم فعلاً باز بماند تا در مسیر تصمیم بگیرم",
    score_a: "J",
    score_b: "P"
  }
};

const typeReports = {
  ISTJ: {
    title: "مسئول دقیق",
    summary: "شما فردی منظم، وظیفه‌شناس، واقع‌گرا و قابل اعتماد هستید. معمولاً به تعهد، ثبات و انجام درست کارها اهمیت زیادی می‌دهید.",
    strengths: ["مسئولیت‌پذیر", "منظم", "قابل اعتماد", "دقیق و جزئی‌نگر"],
    challenges: ["سخت‌گیری بیش از حد", "مقاومت در برابر تغییر", "بیان کم احساسات"],
    communication: "واضح، مستقیم، منطقی و مبتنی بر واقعیت صحبت می‌کنید.",
    workStyle: "در محیط‌های ساختارمند، قانون‌مند و قابل پیش‌بینی عملکرد خوبی دارید.",
    growth: "گاهی به احساسات، انعطاف‌پذیری و دیدگاه‌های جدید هم فضا بدهید.",
    compatibility: "اغلب با تیپ‌های باثبات، متعهد و قابل اعتماد هماهنگی خوبی دارید."
  },
  ISFJ: {
    title: "حامی آرام",
    summary: "شما مهربان، مسئول، وفادار و توجه‌مند به نیازهای دیگران هستید. معمولاً ترجیح می‌دهید در سکوت و بدون هیاهو اثرگذار باشید.",
    strengths: ["مهربان", "وفادار", "مسئول", "جزئی‌نگر"],
    challenges: ["نادیده گرفتن نیازهای خود", "سختی در نه گفتن", "حساسیت به نقد"],
    communication: "گرم، محترمانه و همراه با توجه به احساسات دیگران ارتباط برقرار می‌کنید.",
    workStyle: "در محیط‌های آرام، حمایتی و با نقش‌های مشخص می‌درخشید.",
    growth: "مرزگذاری سالم و بیان خواسته‌های شخصی را بیشتر تمرین کنید.",
    compatibility: "معمولاً با افراد محترم، قدردان و باثبات سازگاری خوبی دارید."
  },
  INFJ: {
    title: "بینش‌گرا",
    summary: "شما عمیق، آینده‌نگر، ارزش‌محور و حساس به معنا هستید. معمولاً به رشد شخصی و درک عمیق انسان‌ها اهمیت می‌دهید.",
    strengths: ["شهود قوی", "همدلی", "بینش عمیق", "هدف‌مندی"],
    challenges: ["فرسودگی احساسی", "کمال‌گرایی", "درون‌ریزی زیاد"],
    communication: "عمیق، معنادار و همراه با درک لایه‌های پنهان ارتباط برقرار می‌کنید.",
    workStyle: "در محیط‌های الهام‌بخش، ارزش‌محور و کم‌تنش بهتر عمل می‌کنید.",
    growth: "مرزهای عاطفی، استراحت و واقع‌بینی را بیشتر در نظر بگیرید.",
    compatibility: "اغلب با تیپ‌های اهل رشد، گفت‌وگوی عمیق و احترام متقابل هماهنگ می‌شوید."
  },
  INTJ: {
    title: "استراتژیست",
    summary: "شما فردی تحلیلی، مستقل، آینده‌نگر و ساختارمند هستید. معمولاً دوست دارید برای مسائل، نقشه و چارچوب روشن داشته باشید.",
    strengths: ["تفکر استراتژیک", "استقلال", "تحلیل قوی", "برنامه‌ریزی"],
    challenges: ["سخت‌گیری", "کم‌حوصلگی در برابر بی‌نظمی", "بیان محدود احساسات"],
    communication: "مستقیم، تحلیلی، هدف‌محور و کم‌حاشیه صحبت می‌کنید.",
    workStyle: "در محیط‌های فکری، حرفه‌ای و هدف‌محور بهترین عملکرد را دارید.",
    growth: "روی انعطاف‌پذیری، صبر و توجه به ابعاد احساسی روابط هم کار کنید.",
    compatibility: "معمولاً با افراد رشدگرا، مستقل و اهل گفت‌وگوی فکری خوب هماهنگ می‌شوید."
  },
  ISTP: {
    title: "عمل‌گرا",
    summary: "شما آرام، مستقل، فنی و مسئله‌حل‌کن هستید. معمولاً در لحظه‌های عملی و واقعی بهترین عملکرد را نشان می‌دهید.",
    strengths: ["تحلیل عملی", "خونسردی", "استقلال", "حل مسئله"],
    challenges: ["بیان کم احساسات", "گریز از تعهد بلندمدت", "بی‌حوصلگی نسبت به ساختار زیاد"],
    communication: "مختصر، کاربردی و بی‌حاشیه ارتباط برقرار می‌کنید.",
    workStyle: "در محیط‌هایی که آزادی عمل، کار فنی و حل مسئله دارند موفق‌تر هستید.",
    growth: "تعهد، ارتباط عاطفی و برنامه‌ریزی بلندمدت را بیشتر تقویت کنید.",
    compatibility: "معمولاً با افراد منطقی، منعطف و کم‌تنش تعامل خوبی دارید."
  },
  ISFP: {
    title: "هنرمند آرام",
    summary: "شما لطیف، درون‌گرا، ارزش‌محور و اغلب خلاق هستید. معمولاً ترجیح می‌دهید آرام و اصیل زندگی کنید.",
    strengths: ["حساسیت زیبایی‌شناختی", "مهربانی", "اصالت", "انعطاف"],
    challenges: ["پنهان کردن احساسات", "تصمیم‌گیری دشوار", "گریز از تعارض"],
    communication: "آرام، محترمانه و بیشتر از طریق رفتار و حس درونی خود ارتباط می‌گیرید.",
    workStyle: "در محیط‌های آزاد، انسانی و خلاق بهتر شکوفا می‌شوید.",
    growth: "بیان روشن نیازها و تصمیم‌گیری قاطع‌تر می‌تواند به رشد شما کمک کند.",
    compatibility: "معمولاً با افراد محترم، آرام و قابل اعتماد سازگاری خوبی دارید."
  },
  INFP: {
    title: "آرمان‌گرا",
    summary: "شما فردی عمیق، ارزش‌محور، خلاق و درون‌گرا هستید. معمولاً به معنا، اصالت و هماهنگی درونی اهمیت زیادی می‌دهید.",
    strengths: ["خلاقیت", "همدلی", "اصالت", "عمق عاطفی"],
    challenges: ["حساسیت زیاد", "کمال‌گرایی درونی", "دشواری در عمل‌گرایی مداوم"],
    communication: "صمیمی، عمیق و ارزش‌محور ارتباط برقرار می‌کنید.",
    workStyle: "در محیط‌هایی که معنا، آزادی و احترام به فردیت وجود دارد بهتر عمل می‌کنید.",
    growth: "مرزگذاری، نظم شخصی و تبدیل ایده به اقدام را بیشتر تمرین کنید.",
    compatibility: "معمولاً با افراد فهمیده، محترم و اهل رشد عاطفی هماهنگ می‌شوید."
  },
  INTP: {
    title: "نظریه‌پرداز",
    summary: "شما فردی کنجکاو، تحلیلی، مستقل و ایده‌محور هستید. معمولاً از فهمیدن ساختار پنهان مسائل لذت می‌برید.",
    strengths: ["تحلیل عمیق", "خلاقیت ذهنی", "استقلال فکری", "کنجکاوی"],
    challenges: ["اقدام‌گرایی پایین", "فراموشی جزئیات اجرایی", "فاصله عاطفی"],
    communication: "فکری، تحلیلی و بیشتر بر ایده‌ها و منطق متمرکز هستید.",
    workStyle: "در محیط‌های فکری، آزاد و کم‌محدودیت بهترین عملکرد را دارید.",
    growth: "اجرایی کردن ایده‌ها، پیگیری و توجه به روابط را بیشتر تقویت کنید.",
    compatibility: "معمولاً با افراد اهل گفت‌وگو، آزاداندیش و کم‌فشار هماهنگ‌تر هستید."
  },
  ESTP: {
    title: "پرتحرک",
    summary: "شما جسور، سریع، عمل‌گرا و اجتماعی هستید. معمولاً در موقعیت‌های زنده و پویا انرژی می‌گیرید.",
    strengths: ["جسارت", "انعطاف", "عمل‌گرایی", "حضور اجتماعی"],
    challenges: ["شتاب‌زدگی", "کم‌حوصلگی برای برنامه‌ریزی طولانی", "ریسک بالا"],
    communication: "مستقیم، زنده، سریع و پرانرژی صحبت می‌کنید.",
    workStyle: "در محیط‌های پویا، رقابتی و عملی بهترین عملکرد را دارید.",
    growth: "صبر، آینده‌نگری و توجه به پیامدهای بلندمدت را بیشتر تمرین کنید.",
    compatibility: "معمولاً با افراد منعطف، پرانرژی و کم‌حاشیه تعامل خوبی دارید."
  },
  ESFP: {
    title: "سرگرم‌کننده",
    summary: "شما اجتماعی، گرم، احساسی و لحظه‌گرا هستید. معمولاً حضور شما به فضا انرژی و سرزندگی می‌دهد.",
    strengths: ["گرمی", "ارتباط‌گیری بالا", "انرژی", "لذت از زندگی"],
    challenges: ["تعلل در برنامه‌ریزی", "گریز از محدودیت", "حساسیت به فشار"],
    communication: "صمیمی، پرانرژی و دوستانه ارتباط برقرار می‌کنید.",
    workStyle: "در محیط‌های انسانی، شاد و تعاملی بهتر شکوفا می‌شوید.",
    growth: "ثبات، نظم و توجه به برنامه بلندمدت برای شما مفید است.",
    compatibility: "معمولاً با افراد گرم، پذیرا و محترم سازگاری خوبی دارید."
  },
  ENFP: {
    title: "الهام‌بخش خلاق",
    summary: "شما پرانرژی، خلاق، کنجکاو و ایده‌پرداز هستید. معمولاً به آدم‌ها، امکان‌ها و تجربه‌های تازه جذب می‌شوید.",
    strengths: ["خلاقیت", "انرژی بالا", "ارتباط‌گیری", "الهام‌بخشی"],
    challenges: ["پراکنده شدن", "شروع زیاد و پایان کم", "حساسیت احساسی"],
    communication: "گرم، الهام‌بخش، صمیمی و پر از ایده ارتباط برقرار می‌کنید.",
    workStyle: "در محیط‌های پویا، خلاق و انسانی بهترین عملکرد را دارید.",
    growth: "تمرکز، پیگیری و ساختاردهی به ایده‌ها رشد شما را بیشتر می‌کند.",
    compatibility: "معمولاً با افراد اهل رشد، گفت‌وگو و ذهن باز هماهنگ می‌شوید."
  },
  ENTP: {
    title: "نوآور",
    summary: "شما سریع‌الذهن، خلاق، چالش‌دوست و ایده‌محور هستید. معمولاً از کشف راه‌های جدید و دیدن زاویه‌های متفاوت لذت می‌برید.",
    strengths: ["نوآوری", "تحلیل سریع", "انعطاف ذهنی", "جذابیت کلامی"],
    challenges: ["بی‌قراری", "ناتمام گذاشتن", "بحث‌جویی زیاد"],
    communication: "پرایده، سریع، تحلیلی و گاهی چالشی صحبت می‌کنید.",
    workStyle: "در محیط‌های پویا، فکری و آزاد عالی عمل می‌کنید.",
    growth: "ثبات، پیگیری و توجه بیشتر به احساسات دیگران برای شما مهم است.",
    compatibility: "معمولاً با افراد بازفکر، منعطف و اهل گفت‌وگوی عمیق هماهنگ هستید."
  },
  ESTJ: {
    title: "مدیر اجرایی",
    summary: "شما منظم، قاطع، عمل‌گرا و مسئول هستید. معمولاً دوست دارید کارها روشن، مشخص و به‌موقع انجام شوند.",
    strengths: ["مدیریت", "قاطعیت", "نظم", "مسئولیت‌پذیری"],
    challenges: ["انعطاف کمتر", "سخت‌گیری", "توجه کمتر به ظرافت‌های احساسی"],
    communication: "شفاف، مستقیم، نتیجه‌محور و صریح ارتباط برقرار می‌کنید.",
    workStyle: "در محیط‌های ساختارمند، هدف‌محور و مدیریتی بهترین عملکرد را دارید.",
    growth: "توجه به احساسات، شنیدن دیدگاه‌های متفاوت و انعطاف بیشتر مفید است.",
    compatibility: "معمولاً با افراد مسئول، شفاف و قابل اعتماد هماهنگی خوبی دارید."
  },
  ESFJ: {
    title: "همراه حمایتگر",
    summary: "شما اجتماعی، دلسوز، مسئول و هماهنگ‌کننده هستید. معمولاً به رضایت، ارتباط خوب و حمایت از دیگران اهمیت می‌دهید.",
    strengths: ["گرمی", "همکاری", "مسئولیت‌پذیری", "توجه به دیگران"],
    challenges: ["وابستگی به تأیید دیگران", "حساسیت به نقد", "فراموشی نیازهای شخصی"],
    communication: "گرم، محترمانه، صمیمی و همراه با توجه به افراد ارتباط برقرار می‌کنید.",
    workStyle: "در محیط‌های تعاملی، انسانی و هماهنگ بهترین عملکرد را دارید.",
    growth: "مرزگذاری سالم و توجه بیشتر به خواسته‌های شخصی برایتان مهم است.",
    compatibility: "معمولاً با افراد قدردان، محترم و قابل اعتماد سازگارتر هستید."
  },
  ENFJ: {
    title: "حامی",
    summary: "شما گرم، الهام‌بخش، مسئول و رابطه‌محور هستید. معمولاً توانایی خوبی در تشویق و هدایت دیگران دارید.",
    strengths: ["رهبری انسانی", "همدلی", "الهام‌بخشی", "مسئولیت‌پذیری"],
    challenges: ["فرسودگی از توجه زیاد به دیگران", "حساسیت به تعارض", "نادیده گرفتن خود"],
    communication: "گرم، الهام‌بخش، شفاف و رابطه‌محور ارتباط برقرار می‌کنید.",
    workStyle: "در محیط‌های انسانی، تیمی و رشددهنده می‌درخشید.",
    growth: "مرزگذاری، استراحت و توجه به نیازهای شخصی برایتان ضروری است.",
    compatibility: "معمولاً با افراد رشدگرا، صادق و اهل ارتباط عمیق هماهنگ می‌شوید."
  },
  ENTJ: {
    title: "فرمانده",
    summary: "شما قاطع، استراتژیک، هدف‌گرا و رهبرمحور هستید. معمولاً دوست دارید مسیر را روشن کنید و به نتیجه برسید.",
    strengths: ["رهبری", "برنامه‌ریزی", "تصمیم‌گیری", "دید استراتژیک"],
    challenges: ["کم‌صبری", "فشار بالا به خود و دیگران", "بیان کم ظرافت احساسی"],
    communication: "شفاف، قاطع، منطقی و نتیجه‌محور صحبت می‌کنید.",
    workStyle: "در محیط‌های چالشی، مدیریتی و هدف‌محور بهترین عملکرد را دارید.",
    growth: "گوش دادن عمیق‌تر، انعطاف و توجه به جنبه‌های انسانی رابطه برایتان مهم است.",
    compatibility: "معمولاً با افراد توانمند، مستقل و رشدگرا هماهنگ‌تر هستید."
  }
};

function isValidAnswer(value) {
  return value === "A" || value === "B";
}

function isComplete(answersObj) {
  for (let i = 1; i <= 60; i++) {
    if (!isValidAnswer(answersObj[i])) return false;
  }
  return true;
}

function getEmptyScores() {
  return { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
}

function getScores(answersObj) {
  const scores = getEmptyScores();

  for (let i = 1; i <= 60; i++) {
    const answer = answersObj[i];
    if (!isValidAnswer(answer)) continue;

    const q = questions[i - 1];
    if (!q) continue;

    if (answer === "A") scores[q.score_a]++;
    if (answer === "B") scores[q.score_b]++;
  }

  for (const dim of ["EI", "SN", "TF", "JP"]) {
    const tieAnswer = answersObj[`tie_${dim}`];
    if (!isValidAnswer(tieAnswer)) continue;

    const tb = tieBreakers[dim];
    if (!tb) continue;

    if (tieAnswer === "A") scores[tb.score_a]++;
    if (tieAnswer === "B") scores[tb.score_b]++;
  }

  return scores;
}

function getPendingTies(scores, answersObj) {
  const ties = [];

  if (scores.E === scores.I && !isValidAnswer(answersObj.tie_EI)) ties.push("EI");
  if (scores.S === scores.N && !isValidAnswer(answersObj.tie_SN)) ties.push("SN");
  if (scores.T === scores.F && !isValidAnswer(answersObj.tie_TF)) ties.push("TF");
  if (scores.J === scores.P && !isValidAnswer(answersObj.tie_JP)) ties.push("JP");

  return ties;
}

function buildFinalType(scores) {
  return (
    (scores.E > scores.I ? "E" : "I") +
    (scores.S > scores.N ? "S" : "N") +
    (scores.T > scores.F ? "T" : "F") +
    (scores.J > scores.P ? "J" : "P")
  );
}

function getPercentages(scores) {
  const calc = (a, b) => {
    const total = a + b;
    if (total === 0) return [0, 0];
    return [
      Math.round((a / total) * 100),
      Math.round((b / total) * 100)
    ];
  };

  const [E, I] = calc(scores.E, scores.I);
  const [S, N] = calc(scores.S, scores.N);
  const [T, F] = calc(scores.T, scores.F);
  const [J, P] = calc(scores.J, scores.P);

  return { E, I, S, N, T, F, J, P };
}

function getTypeReport(type) {
  return typeReports[type] || {
    title: type,
    summary: "گزارش این تیپ در حال تکمیل است.",
    strengths: [],
    challenges: [],
    communication: "—",
    workStyle: "—",
    growth: "—",
    compatibility: "—"
  };
}

function calculateResult(answersObj) {
  if (!answersObj || typeof answersObj !== "object") {
    return { error: "invalid_answers_object" };
  }

  if (!isComplete(answersObj)) {
    return { error: "incomplete_answers" };
  }

  const scoresWithoutTie = getEmptyScores();

  for (let i = 1; i <= 60; i++) {
    const answer = answersObj[i];
    const q = questions[i - 1];
    if (!q || !isValidAnswer(answer)) continue;

    if (answer === "A") scoresWithoutTie[q.score_a]++;
    if (answer === "B") scoresWithoutTie[q.score_b]++;
  }

  const pendingTies = getPendingTies(scoresWithoutTie, answersObj);
  if (pendingTies.length > 0) {
    return {
      hasTies: true,
      ties: pendingTies,
      tieQuestions: pendingTies.map(dim => tieBreakers[dim]),
      scores: scoresWithoutTie
    };
  }

  const finalScores = getScores(answersObj);
  const finalType = buildFinalType(finalScores);
  const percentages = getPercentages(finalScores);
  const report = getTypeReport(finalType);

  return {
    hasTies: false,
    finalType,
    scores: finalScores,
    percentages,
    report
  };
}

function formatPercentages(percentages) {
  return (
    `• E / I : ${percentages.E}% / ${percentages.I}%\n` +
    `• S / N : ${percentages.S}% / ${percentages.N}%\n` +
    `• T / F : ${percentages.T}% / ${percentages.F}%\n` +
    `• J / P : ${percentages.J}% / ${percentages.P}%`
  );
}

function formatShortResult(result) {
  if (!result || result.error || result.hasTies) return null;

  return (
    `🎉 نتیجه تست شخصیت شما آماده شد\n\n` +
    `🔹 تیپ شخصیتی شما: ${result.finalType}\n` +
    `🔹 عنوان تیپ: ${result.report.title}\n\n` +
    `📝 خلاصه شخصیت:\n${result.report.summary}\n\n` +
    `📊 درصد گرایش‌ها:\n${formatPercentages(result.percentages)}\n\n` +
    `⚠️ توجه: این نتیجه یک ابزار خودشناسی است و نباید به‌عنوان تشخیص قطعی یا ارزیابی بالینی در نظر گرفته شود.`
  );
}

function formatFullReport(result) {
  if (!result || result.error || result.hasTies) return null;

  const strengths = result.report.strengths.map(item => `• ${item}`).join("\n");
  const challenges = result.report.challenges.map(item => `• ${item}`).join("\n");

  return (
    `📘 گزارش کامل تست شخصیت\n\n` +
    `🔹 تیپ شخصیتی: ${result.finalType}\n` +
    `🔹 عنوان تیپ: ${result.report.title}\n\n` +
    `📝 خلاصه:\n${result.report.summary}\n\n` +
    `✅ نقاط قوت:\n${strengths || "• —"}\n\n` +
    `⚠️ چالش‌های احتمالی:\n${challenges || "• —"}\n\n` +
    `💬 سبک ارتباطی:\n${result.report.communication}\n\n` +
    `💼 سبک کاری و محیط مناسب:\n${result.report.workStyle}\n\n` +
    `🌱 پیشنهاد رشد فردی:\n${result.report.growth}\n\n` +
    `❤️ سازگاری کلی:\n${result.report.compatibility}\n\n` +
    `📊 درصد گرایش‌ها:\n${formatPercentages(result.percentages)}\n\n` +
    `📌 یادآوری مهم:\n` +
    `این تست برای خودشناسی طراحی شده و نتیجه آن قطعی و تغییرناپذیر نیست. شرایط زندگی، محیط، تجربه‌ها و رشد فردی می‌توانند روی رفتار و سبک شخصیت اثر بگذارند.`
  );
}

module.exports = {
  questions,
  tieBreakers,
  typeReports,
  isValidAnswer,
  isComplete,
  getScores,
  getPendingTies,
  buildFinalType,
  getPercentages,
  getTypeReport,
  calculateResult,
  formatShortResult,
  formatFullReport
};
