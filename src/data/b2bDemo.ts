export type IndustryCode = 'apparel' | 'packaging' | 'food' | 'beauty';

export type IndustryField = {
  id: string;
  label: string;
  required: boolean;
  type: 'text' | 'choice';
  placeholder?: string;
  options?: string[];
};

export type Industry = {
  id: IndustryCode;
  label: string;
  description: string;
  fields: IndustryField[];
};

export type SupplierOffer = {
  id: string;
  supplier: string;
  total: string;
  leadTime: string;
  score: number;
  status: 'new' | 'selected' | 'competitive';
};

export type SupplierProfile = {
  id: string;
  name: string;
  country: string;
  category: string;
  verified: boolean;
  score: number;
  leadTime: string;
  minOrder: string;
  responseRate: string;
  specialties: string[];
  status: 'active' | 'new';
};

export type DemoRFQ = {
  id: string;
  title: string;
  industry: IndustryCode;
  quantity: number;
  unit: string;
  status: string;
  statusTone: 'green' | 'amber' | 'blue' | 'muted';
  quoteCount: number;
  dueDate: string;
  summary: string;
  details: Record<string, string>;
  selectedOfferId?: string;
  offers?: SupplierOffer[];
};

export const industries: Industry[] = [
  {
    id: 'apparel',
    label: 'الملابس والمنسوجات',
    description: 'ملابس جاهزة، أقمشة، وتفصيل خاص',
    fields: [
      { id: 'productType', label: 'نوع المنتج', required: true, type: 'text', placeholder: 'مثال: قميص قطني يومي' },
      { id: 'fabric', label: 'الخامة الأساسية', required: true, type: 'choice', options: ['قطن 100٪', 'قطن عضوي', 'بوليستر معاد تدويره', 'خليط كتان'] },
      { id: 'sizes', label: 'المقاسات المطلوبة', required: true, type: 'text', placeholder: 'مثال: S إلى XXL' },
      { id: 'finish', label: 'تفاصيل إضافية', required: false, type: 'text', placeholder: 'طباعة، تطريز، أو متطلبات تغليف' },
    ],
  },
  {
    id: 'packaging',
    label: 'التغليف والعبوات',
    description: 'علب، أكياس، وعبوات تحمل علامتك',
    fields: [
      { id: 'packageType', label: 'نوع العبوة', required: true, type: 'choice', options: ['علبة كرتونية', 'كيس مرن', 'زجاجة', 'عبوة معدنية'] },
      { id: 'material', label: 'المادة', required: true, type: 'choice', options: ['كرتون معاد تدويره', 'كرتون مقوّى', 'زجاج', 'ألمنيوم'] },
      { id: 'capacity', label: 'السعة أو الأبعاد', required: true, type: 'text', placeholder: 'مثال: 250 مل أو 12 × 8 × 4 سم' },
      { id: 'print', label: 'الطباعة والتشطيب', required: false, type: 'text', placeholder: 'ألوان، طلاء، أو نقش خاص' },
    ],
  },
  {
    id: 'food',
    label: 'الأغذية والمشروبات',
    description: 'تصنيع وتعبئة للعلامات التجارية',
    fields: [
      { id: 'productType', label: 'نوع المنتج', required: true, type: 'text', placeholder: 'مثال: تمر مجفف بالتجميد' },
      { id: 'processing', label: 'طريقة التصنيع', required: true, type: 'choice', options: ['تجفيف', 'تحميص', 'خلط وتعبئة', 'تخمير'] },
      { id: 'shelfLife', label: 'مدة الصلاحية المستهدفة', required: true, type: 'text', placeholder: 'مثال: 12 شهرًا' },
      { id: 'certifications', label: 'الشهادات المطلوبة', required: false, type: 'text', placeholder: 'مثال: HACCP أو حلال' },
    ],
  },
  {
    id: 'beauty',
    label: 'العناية والجمال',
    description: 'تركيبات ومنتجات عناية بعلامتك',
    fields: [
      { id: 'productType', label: 'نوع المنتج', required: true, type: 'choice', options: ['عناية بالبشرة', 'عناية بالشعر', 'عطور', 'صابون'] },
      { id: 'form', label: 'القوام أو التركيبة', required: true, type: 'text', placeholder: 'مثال: كريم مرطب خفيف' },
      { id: 'package', label: 'نوع العبوة', required: true, type: 'choice', options: ['مضخة', 'أنبوب', 'مرطبان', 'زجاجة قطّارة'] },
      { id: 'ingredients', label: 'مكونات أو اشتراطات', required: false, type: 'text', placeholder: 'مكونات مفضلة أو مستبعدة' },
    ],
  },
];

export const initialRfqs: DemoRFQ[] = [
  {
    id: 'SQ-2487',
    title: 'قمصان قطنية لعلامة نواة',
    industry: 'apparel',
    quantity: 2400,
    unit: 'قطعة',
    status: 'وصلت عروض جديدة',
    statusTone: 'green',
    quoteCount: 4,
    dueDate: 'ينتهي خلال ٦ أيام',
    summary: 'قمصان يومية بقصّة واسعة، بخامة قطن عضوي وتدرجات لونية خاصة.',
    details: { productType: 'قميص قطني يومي', fabric: 'قطن عضوي', sizes: 'S إلى XXL' },
    selectedOfferId: 'offer-2',
    offers: [
      { id: 'offer-1', supplier: 'دار النسيج الأولى', total: '٤٬٩٢٠ ر.س', leadTime: '١٤ يوم', score: 88, status: 'competitive' },
      { id: 'offer-2', supplier: 'مصنع مدار للملابس', total: '٤٬٣٢٠ ر.س', leadTime: '١٢ يوم', score: 95, status: 'selected' },
      { id: 'offer-3', supplier: 'منسوجات الشرق', total: '٤٬٦٨٠ ر.س', leadTime: '١٥ يوم', score: 91, status: 'new' },
    ],
  },
  {
    id: 'SQ-2485',
    title: 'علب شحن من كرتون معاد تدويره',
    industry: 'packaging',
    quantity: 8000,
    unit: 'علبة',
    status: 'مطابقة المصانع',
    statusTone: 'blue',
    quoteCount: 2,
    dueDate: 'ينتهي خلال ٩ أيام',
    summary: 'علب شحن متينة مع طباعة بلون واحد للطلبات الإلكترونية.',
    details: { packageType: 'علبة كرتونية', material: 'كرتون معاد تدويره', capacity: '30 × 20 × 10 سم' },
    selectedOfferId: 'offer-5',
    offers: [
      { id: 'offer-4', supplier: 'أوراق النورس', total: '١٨٬٤٠٠ ر.س', leadTime: '٩ أيام', score: 90, status: 'new' },
      { id: 'offer-5', supplier: 'عبوات الخليج', total: '١٦٬٩٠٠ ر.س', leadTime: '٧ أيام', score: 94, status: 'selected' },
    ],
  },
  {
    id: 'SQ-2482',
    title: 'خليط تمر وقهوة مختصة',
    industry: 'food',
    quantity: 1200,
    unit: 'عبوة',
    status: 'اعتماد العينة',
    statusTone: 'amber',
    quoteCount: 3,
    dueDate: 'بانتظار ملاحظاتك',
    summary: 'خلطة موسمية بعبوات تجريبية قبل بدء دفعة الإنتاج.',
    details: { productType: 'خليط تمر وقهوة', processing: 'خلط وتعبئة', shelfLife: '9 أشهر' },
    selectedOfferId: 'offer-6',
    offers: [
      { id: 'offer-6', supplier: 'ملح ونعناع', total: '٦٬٨٠٠ ر.س', leadTime: '١٦ يوم', score: 92, status: 'selected' },
      { id: 'offer-7', supplier: 'مزارع التوابل', total: '٧٬٣٤٠ ر.س', leadTime: '١٨ يوم', score: 87, status: 'competitive' },
      { id: 'offer-8', supplier: 'أرز النخيل', total: '٧٬٥٢٠ ر.س', leadTime: '١٣ يوم', score: 85, status: 'new' },
    ],
  },
];

export const supplierProfiles: SupplierProfile[] = [
  {
    id: 'sup-1',
    name: 'مصنع مدار للملابس',
    country: 'السعودية',
    category: 'ملابس ومنسوجات',
    verified: true,
    score: 96,
    leadTime: '١٢ يوم',
    minOrder: '١٬٥٠٠ قطعة',
    responseRate: '٩٨%',
    specialties: ['قطن عضوي', 'طباعة', 'تجهيز خاص'],
    status: 'active',
  },
  {
    id: 'sup-2',
    name: 'عبوات الخليج',
    country: 'الإمارات',
    category: 'تغليف وعبوات',
    verified: true,
    score: 94,
    leadTime: '٧ أيام',
    minOrder: '٥٬٠٠٠ علبة',
    responseRate: '٩٦%',
    specialties: ['كرتون معاد التدوير', 'تغليف هدايا', 'طباعة دقيقة'],
    status: 'active',
  },
  {
    id: 'sup-3',
    name: 'مزرعة التوابل',
    country: 'الأردن',
    category: 'أغذية ومشروبات',
    verified: false,
    score: 88,
    leadTime: '١٨ يوم',
    minOrder: '١٬٢٠٠ عبوة',
    responseRate: '٩٠%',
    specialties: ['خلطة مخصصة', 'حفظ طويل', 'تعبئة حديثة'],
    status: 'new',
  },
  {
    id: 'sup-4',
    name: 'نور العناية',
    country: 'الكويت',
    category: 'العناية والجمال',
    verified: true,
    score: 92,
    leadTime: '١٤ يوم',
    minOrder: '١٬٠٠٠ وحدة',
    responseRate: '٩٥%',
    specialties: ['مكونات طبيعية', 'أقنعة', 'زجاجات أنبوب'],
    status: 'active',
  },
];

export const activityItems = [
  { time: 'قبل ٢ ساعة', title: 'وصل عرض جديد', detail: 'قمصان قطنية لعلامة نواة · مصنع مدار للملابس', kind: 'quote' },
  { time: 'أمس', title: 'العينة جاهزة للمراجعة', detail: 'خليط تمر وقهوة مختصة · الإصدار الأول', kind: 'sample' },
  { time: 'منذ يومين', title: 'بدأ تجهيز المواد', detail: 'عبوات زجاجية للعناية · طلب توريد تجريبي', kind: 'production' },
];

export function getIndustryLabel(code: IndustryCode) {
  return industries.find((industry) => industry.id === code)?.label ?? 'قطاع آخر';
}
