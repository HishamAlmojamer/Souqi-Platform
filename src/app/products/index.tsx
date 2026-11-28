import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { StatusPill } from '@/components/b2b/StatusPill';
import { MotionPressable, ScreenEntrance, Stagger } from '@/components/b2b/motion';
import { lifecycleStyles as s } from '@/components/b2b/lifecycleStyles';
import {
  formatMoney,
  formatNumber,
  PRODUCT_STATUS,
  statusInfo,
  useApiQuery,
  type ApiProduct,
} from '@/data/api';

type ProductsPayload = { products: ApiProduct[] };

export default function ProductsScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const query = useApiQuery<ProductsPayload>('/api/products?pageSize=100');
  const products = useMemo(() => query.data?.products ?? [], [query.data?.products]);
  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products],
  );
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const matchesTerm = !term || `${product.title} ${product.sku ?? ''} ${product.description}`.toLocaleLowerCase().includes(term);
      const matchesCategory = category === 'all' || product.category === category;
      return matchesTerm && matchesCategory && product.status === 'ACTIVE';
    });
  }, [category, products, search]);

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <AppHeader active="suppliers" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={s.content}>
          <View style={s.headingRow}>
            <View style={s.headingCopy}>
              <Text style={s.kicker}>Catalog & Custom Manufacturing</Text>
              <Text style={s.pageTitle}>كتالوج المنتجات القابلة للتصنيع</Text>
              <Text style={s.pageSubtitle}>اختر منتجًا جاهزًا أو ابدأ مواصفة مخصصة، ثم أرسل طلب عرض مع المرفقات الهندسية.</Text>
            </View>
            <Link href="/rfq/new" asChild>
              <MotionPressable accessibilityRole="link" style={s.returnButton}>
                <Text style={s.returnButtonText}>طلب عرض جديد ←</Text>
              </MotionPressable>
            </Link>
          </View>

          <ApiFeedback
            loading={query.isLoading}
            error={query.error}
            empty={!query.isLoading && visible.length === 0}
            emptyTitle="لا توجد منتجات مطابقة"
            emptyBody="جرّب تغيير الفئة أو ابحث باسم المنتج."
            onRetry={() => { void query.refetch(); }}
          />

          <View style={s.panel}>
            <TextInput
              accessibilityLabel="البحث في المنتجات"
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث بالاسم أو رمز المنتج"
              placeholderTextColor="#8A948D"
              style={s.input}
              textAlign="right"
            />
            <View style={s.chipRow}>
              <MotionPressable accessibilityRole="button" accessibilityState={{ selected: category === 'all' }} onPress={() => setCategory('all')} style={[s.chip, category === 'all' && s.chipActive]}>
                <Text style={[s.chipText, category === 'all' && s.chipTextActive]}>كل الفئات</Text>
              </MotionPressable>
              {categories.map((item) => (
                <MotionPressable key={item} accessibilityRole="button" accessibilityState={{ selected: category === item }} onPress={() => setCategory(item)} style={[s.chip, category === item && s.chipActive]}>
                  <Text style={[s.chipText, category === item && s.chipTextActive]}>{item}</Text>
                </MotionPressable>
              ))}
            </View>
          </View>

          <View style={[s.grid, s.gridWide]}>
            <View style={s.mainColumn}>
              <View style={s.list}>
                {visible.map((product, index) => {
                  const status = statusInfo(PRODUCT_STATUS, product.status);
                  return (
                    <Stagger key={product.id} index={index} baseDelay={90} step={35} translateY={8}>
                      <View style={s.card}>
                        <View style={s.cardHeader}>
                          <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={s.cardTitle}>{product.title}</Text>
                            <Text style={s.meta}>
                              {product.category} · {product.supplierOrg?.displayName ?? 'مورد'}
                            </Text>
                          </View>
                          <StatusPill label={status.label} tone={status.tone} small />
                        </View>
                        <Text style={s.body} numberOfLines={2}>{product.description}</Text>
                        <View style={s.detailRow}>
                          <Text style={s.detailLabel}>السعر التقديري</Text>
                          <Text style={s.detailValue}>{product.priceCents ? formatMoney(product.priceCents, product.currency) : 'عند الطلب'}</Text>
                        </View>
                        <View style={s.detailRow}>
                          <Text style={s.detailLabel}>الحد الأدنى / المهلة</Text>
                          <Text style={s.detailValue}>
                            {formatNumber(product.minOrderQuantity)} / {product.leadTimeDays ? `${product.leadTimeDays} يوم` : '—'}
                          </Text>
                        </View>
                        <View style={s.buttonRow}>
                          <Link href={`/products/${product.id}`} asChild>
                            <MotionPressable accessibilityRole="link" style={s.button}>
                              <Text style={s.buttonText}>عرض المنتج</Text>
                            </MotionPressable>
                          </Link>
                        </View>
                      </View>
                    </Stagger>
                  );
                })}
              </View>
            </View>

            <View style={s.sideColumn}>
              <View style={s.panel}>
                <Text style={s.panelTitle}>كيف تعمل المنصة؟</Text>
                <Text style={s.body}>١. اختر المنتج أو ارفع مواصفاتك. {'\n'}٢. قارن عروض المصانع المدققة. {'\n'}٣. اعتمد العينة قبل الإنتاج. {'\n'}٤. تابع الضمان والشحن حتى التسليم.</Text>
              </View>
              <View style={s.panel}>
                <Text style={s.panelTitle}>روابط سريعة</Text>
                <Link href="/suppliers" asChild>
                  <MotionPressable accessibilityRole="link" style={[s.button, { marginTop: 8 }]}>
                    <Text style={s.buttonText}>تصفح المصانع</Text>
                  </MotionPressable>
                </Link>
              </View>
            </View>
          </View>
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}
