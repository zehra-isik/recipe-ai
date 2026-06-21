import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from './entities/recipe.entity';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import axios from 'axios';
import FormData = require('form-data');

@Injectable()
export class RecipesService {
  private readonly geminiKey =
    process.env.GEMINI_API_KEY ||
    '';
  private readonly genAI = new GoogleGenerativeAI(this.geminiKey);

  private readonly botHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    Connection: 'keep-alive',
  };

  constructor(
    @InjectRepository(Recipe)
    private recipesRepository: Repository<Recipe>,
    private httpService: HttpService,
  ) { }

  create(createRecipeDto: any) {
    const newRecipe = this.recipesRepository.create(createRecipeDto);
    return this.recipesRepository.save(newRecipe);
  }

  async findAll(): Promise<any[]> {
    const recipes = await this.recipesRepository.find({
      relations: { favoritedBy: true },
    });

    return recipes.map((recipe: any) => ({
      ...recipe,
      favoriteCount: recipe.favoritedBy ? recipe.favoritedBy.length : 0,
    }));
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private randomDelay(min = 1800, max = 4500) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/i̇/g, 'i')
      .replace(/İ/g, 'i')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private formatDuration(value: any): string {
    if (!value) return 'Belirtilmedi';

    const text = String(value).trim();
    const isoMatch = text.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);

    if (isoMatch) {
      const hours = Number(isoMatch[1] || 0);
      const minutes = Number(isoMatch[2] || 0);
      const totalMinutes = hours * 60 + minutes;
      return totalMinutes > 0 ? `${totalMinutes} dk` : 'Belirtilmedi';
    }

    return text || 'Belirtilmedi';
  }

  private formatServings(value: any): string {
    if (!value) return 'Belirtilmedi';

    if (Array.isArray(value)) {
      return value.map(item => String(item).trim()).filter(Boolean).join(', ');
    }

    return String(value).replace(/Kaç Kişilik/i, '').replace(/:/g, '').trim() ||
      'Belirtilmedi';
  }

  private getSourceSite(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'Bilinmiyor';
    }
  }

  private getCategoryLabel(category: string): string {
    const categoryMap: Record<string, string> = {
      'kategori/tarifler/ana-yemekler': 'Ana Yemekler',
      'kategori/tarifler/tavuk-yemekleri': 'Tavuk Yemekleri',
      'kategori/tarifler/et-yemekleri': 'Et Yemekleri',
      'kategori/tarifler/sebze-yemekleri': 'Sebze Yemekleri',
      'kategori/tarifler/corba-tarifleri': 'Çorba Tarifleri',
      'kategori/tarifler/kahvaltilik-tarifleri': 'Kahvaltılık Tarifleri',
      'kategori/tarifler/hamur-isi-tarifleri': 'Hamur İşi Tarifleri',
      'kategori/tarifler/borek-tarifleri': 'Börek Tarifleri',
      'kategori/tarifler/pogaca-tarifleri': 'Poğaça Tarifleri',
      'kategori/tarifler/makarna-tarifleri': 'Makarna Tarifleri',
      'kategori/tarifler/pilav-tarifleri': 'Pilav Tarifleri',
      'kategori/tarifler/salata-meze-kanepe': 'Salata Meze Kanepe',
      'kategori/tarifler/tatli-tarifleri': 'Tatlı Tarifleri',
      'kategori/tarifler/kek-tarifleri': 'Kek Tarifleri',
      'kategori/tarifler/kurabiye-tarifleri': 'Kurabiye Tarifleri',
      'kategori/tarifler/sutlu-tatli-tarifleri': 'Sütlü Tatlı Tarifleri',
    };

    return categoryMap[category] || category;
  }

  private inferRecipeCategory(name: string, ingredients: string[], fallbackCategory: string) {
    const nameText = this.normalizeIngredient(name)
      .replace(/[^a-zçğıöşü0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const text = this.normalizeIngredient(`${name} ${ingredients.join(' ')}`)
      .replace(/[^a-zçğıöşü0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const hasAnyIn = (target: string, words: string[]) =>
      words.some(word => {
        const normalizedWord = this.normalizeIngredient(word)
          .replace(/[^a-zçğıöşü0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const escapedWord = normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|\\s)${escapedWord}(\\s|$)`, 'i').test(target);
      });
    const hasAny = (words: string[]) => hasAnyIn(text, words);
    const nameHasAny = (words: string[]) => hasAnyIn(nameText, words);

    if (nameHasAny(['menemen', 'omlet', 'yumurta', 'yumurtalı', 'kahvaltı', 'kahvaltılık', 'pankek'])) return 'Kahvaltılık Tarifleri';
    if (nameHasAny(['çorba', 'çorbası', 'corba', 'corbasi'])) return 'Çorba Tarifleri';
    if (nameHasAny(['salata', 'meze', 'kanepe', 'kısır'])) return 'Salata Meze Kanepe';
    if (nameHasAny(['pilav', 'şehriye', 'sehriye'])) return 'Pilav Tarifleri';
    if (nameHasAny(['makarna', 'spagetti', 'erişte'])) return 'Makarna Tarifleri';
    if (nameHasAny(['pizza', 'pide', 'lahmacun'])) return 'Hamur İşi Tarifleri';
    if (nameHasAny(['kurabiye'])) return 'Kurabiye Tarifleri';
    if (nameHasAny(['kek', 'browni', 'brownie', 'islak kek'])) return 'Kek Tarifleri';
    if (nameHasAny(['pasta', 'magnolia', 'cheesecake', 'tatlı', 'tatlisi', 'reçel', 'helva', 'muhallebi', 'sütlaç', 'puding', 'trileçe', 'donut', 'cookie', 'tart', 'turta'])) return 'Tatlı Tarifleri';
    if (nameHasAny(['patlıcan', 'kabak', 'pırasa', 'ıspanak', 'kereviz', 'lahana', 'brokoli', 'bezelye', 'domates'])) return 'Sebze Yemekleri';
    if (nameHasAny(['etli', 'ciğer', 'ciger', 'kebap', 'kebab', 'kıyma', 'kiyma', 'köfte', 'kofte', 'et sote'])) return 'Et Yemekleri';
    if (nameHasAny(['börek', 'borek', 'börekitas', 'yufka', 'paçanga', 'pacanga'])) return 'Börek Tarifleri';
    if (nameHasAny(['poğaça', 'pogaca', 'açma', 'simit', 'çörek', 'corek'])) return 'Poğaça Tarifleri';

    if (hasAny(['pankek', 'kahvaltı', 'kahvaltilik'])) return 'Kahvaltılık Tarifleri';
    if (hasAny(['mercimek köftesi'])) return 'Salata Meze Kanepe';
    if (hasAny(['tavuk', 'kfc', 'hindi'])) return 'Tavuk Yemekleri';
    if (hasAny(['ciğer', 'ciger', 'kebap', 'kebab', 'kıyma', 'kiyma', 'köfte', 'kofte', 'et sote', 'kırmızı et', 'dana', 'kuzu'])) return 'Et Yemekleri';
    if (hasAny(['salata', 'meze', 'kanepe', 'kısır'])) return 'Salata Meze Kanepe';
    if (hasAny(['makarna', 'spagetti', 'erişte'])) return 'Makarna Tarifleri';
    if (hasAny(['pilav', 'şehriye', 'sehriye', 'pirinç', 'bulgur pilavı'])) return 'Pilav Tarifleri';
    if (hasAny(['kurabiye'])) return 'Kurabiye Tarifleri';
    if (hasAny(['kek', 'browni', 'brownie', 'islak kek'])) return 'Kek Tarifleri';
    if (hasAny(['pasta', 'magnolia', 'cheesecake', 'tatlı', 'tatlisi', 'reçel', 'helva', 'lokum', 'muhallebi', 'sütlaç', 'puding'])) return 'Tatlı Tarifleri';
    if (hasAny(['poğaça', 'pogaca', 'açma', 'simit', 'çörek', 'corek'])) return 'Poğaça Tarifleri';
    if (hasAny(['börek', 'borek', 'yufka', 'paçanga', 'pacanga'])) return 'Börek Tarifleri';
    if (hasAny(['patlıcan', 'kabak', 'pırasa', 'ıspanak', 'kereviz', 'lahana', 'brokoli', 'sebze'])) return 'Sebze Yemekleri';

    return fallbackCategory && fallbackCategory !== 'Genel' ? fallbackCategory : 'Genel';
  }

  private async fetchHtml(url: string, retries = 3): Promise<string | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(url, {
          headers: this.botHeaders,
          timeout: 20000,
          maxRedirects: 5,
        });

        if (typeof response.data === 'string' && response.data.length > 500) {
          return response.data;
        }

        console.log(`ZAYIF HTML: ${url} | length=${String(response.data).length}`);
      } catch (error: any) {
        console.log(`ISTEK HATASI: ${url} | deneme=${attempt} | ${error.message}`);
        await this.sleep(2000 * attempt);
      }
    }

    return null;
  }

  private normalizeIngredient(text: string): string {
    return text
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .replace(/maydonoz/g, 'maydanoz')
      .replace(/tavuk göğsü/g, 'tavuk')
      .replace(/tavuk but/g, 'tavuk')
      .replace(/tavuk pirzola/g, 'tavuk')
      .replace(/kanat/g, 'tavuk')
      .replace(/hindi/g, 'tavuk')
      .replace(/göğüs/g, 'tavuk')
      .replace(/dana eti/g, 'kırmızı et')
      .replace(/kuzu eti/g, 'kırmızı et')
      .replace(/kuşbaşı et/g, 'kırmızı et')
      .replace(/kuru soğan/g, 'soğan')
      .replace(/taze soğan/g, 'soğan')
      .replace(/yeşil biber/g, 'biber')
      .replace(/kırmızı biber/g, 'biber')
      .replace(/kapya biber/g, 'biber')
      .replace(/sivri biber/g, 'biber')
      .replace(/domates salçası/g, 'salça')
      .replace(/biber salçası/g, 'salça')
      .replace(/zeytinyağı/g, 'sıvı yağ')
      .replace(/sıvıyağ/g, 'sıvı yağ')
      .replace(/damla çikolata/g, 'çikolata')
      .replace(/toz şeker/g, 'şeker')
      .replace(/pudingi/g, 'puding')
      .replace(/puding tozu/g, 'puding')
      .replace(/vanilyalı puding/g, 'puding')
      .replace(/[(),.;:]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private cleanIngredientLine(text: string): string {
    return this.normalizeIngredient(
      text
        .toLowerCase()
        .replace(/[0-9]/g, '')
        .replace(/yarım/g, '')
        .replace(/bir/g, '')
        .replace(/iki/g, '')
        .replace(/üç/g, '')
        .replace(/dört/g, '')
        .replace(/beş/g, '')
        .replace(/su bardağı/g, '')
        .replace(/çay bardağı/g, '')
        .replace(/yemek kaşığı/g, '')
        .replace(/tatlı kaşığı/g, '')
        .replace(/çay kaşığı/g, '')
        .replace(/gram/g, '')
        .replace(/gr/g, '')
        .replace(/kg/g, '')
        .replace(/adet/g, '')
        .replace(/paket/g, '')
        .replace(/tane/g, '')
        .replace(/demet/g, '')
        .replace(/tutam/g, '')
        .replace(/isteğe bağlı/g, '')
        .replace(/üzeri için/g, '')
        .replace(/iç harcı için/g, '')
        .replace(/kızartmak için/g, '')
        .replace(/[.,:;()/]/g, '')
        .trim(),
    );
  }

  private isLikelyIngredientLine(text: string): boolean {
    const normalized = this.normalizeText(text);

    if (!normalized || normalized.length < 2 || normalized.length > 100) {
      return false;
    }

    const blockedWords = [
      'giriş yap',
      'üye ol',
      'tarifler',
      'videolar',
      'menüler',
      'blog',
      'listeler',
      'kaç kalori',
      'yorumlar',
      'deneyenler',
      'deftere ekle',
      'eline sağlık',
      'iletişim',
      'hakkında',
      'kullanım koşulları',
      'soru cevap',
      'bugün ne pişirsem',
      'yazarlar',
      'trend',
      'kategori',
      'video',
      'pasta tarifleri',
      'kek tarifleri',
      'kurabiye tarifleri',
      'tatlı tarifleri',
    ];

    if (blockedWords.some(word => normalized.includes(word))) {
      return false;
    }

    if (/^\+?\s*\d+\s*(yorum|deneyen|kişi|dk|dakika)$/i.test(normalized)) {
      return false;
    }

    return true;
  }

  private extractBaseIngredients(rawIngredients: string[]): string[] {
    const knownIngredients = [
      'tavuk göğsü',
      'tavuk but',
      'tavuk pirzola',
      'tavuk',
      'kanat',
      'hindi',
      'göğüs',
      'kıyma',
      'kırmızı et',
      'kuşbaşı et',
      'dana eti',
      'kuzu eti',
      'patlıcan',
      'patates',
      'domates',
      'soğan',
      'kuru soğan',
      'taze soğan',
      'sarımsak',
      'maydanoz',
      'maydonoz',
      'biber',
      'yeşil biber',
      'kırmızı biber',
      'kapya biber',
      'sivri biber',
      'havuç',
      'kabak',
      'mantar',
      'ıspanak',
      'pırasa',
      'kereviz',
      'lahana',
      'brokoli',
      'salatalık',
      'marul',
      'yumurta',
      'süt',
      'yoğurt',
      'peynir',
      'kaşar',
      'un',
      'şeker',
      'tuz',
      'karabiber',
      'pul biber',
      'kırmızı toz biber',
      'kimyon',
      'kekik',
      'nane',
      'dereotu',
      'tarçın',
      'salça',
      'domates salçası',
      'biber salçası',
      'sıvı yağ',
      'zeytinyağı',
      'tereyağı',
      'pirinç',
      'bulgur',
      'makarna',
      'mercimek',
      'nohut',
      'fasulye',
      'bezelye',
      'mısır',
      'limon',
      'ceviz',
      'fındık',
      'badem',
      'kakao',
      'çikolata',
      'bisküvi',
      'puding',
      'vanilya',
      'kiraz',
      'krema',
      'bal',
      'pekmez',
      'tahin',
      'maya',
      'su',
    ];

    const fullText = rawIngredients.join(' ').toLowerCase();
    const result: string[] = [];

    for (const word of knownIngredients) {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s)${escapedWord}(\\s|$)`, 'i');

      if (regex.test(fullText)) {
        const normalized = this.normalizeIngredient(word);
        if (!result.includes(normalized)) {
          result.push(normalized);
        }
      }
    }

    for (const raw of rawIngredients) {
      if (!this.isLikelyIngredientLine(raw)) {
        continue;
      }

      const cleaned = this.cleanIngredientLine(raw);

      if (
        cleaned.length > 2 &&
        cleaned.length < 35 &&
        !cleaned.includes('için') &&
        !cleaned.includes('üzeri') &&
        !result.some(
          ingredient =>
            cleaned.includes(ingredient) || ingredient.includes(cleaned),
        ) &&
        !result.includes(cleaned)
      ) {
        result.push(cleaned);
      }
    }

    return [...new Set(result)];
  }

  private buildComparableIngredients(rawIngredients: any[]): string[] {
    const textIngredients = rawIngredients
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean);

    const normalizedIngredients = textIngredients
      .map(item => this.normalizeIngredient(item))
      .filter(item => item.length > 1 && item.length <= 30 && !/\d/.test(item));

    const cleanedIngredients = textIngredients
      .map(item => this.cleanIngredientLine(item))
      .filter(item => item.length > 1 && item.length <= 30);

    const baseIngredients = this.extractBaseIngredients(textIngredients);

    if (baseIngredients.length > 0) {
      return baseIngredients;
    }

    return ([
      ...new Set([
        ...normalizedIngredients,
        ...cleanedIngredients,
      ]),
    ]).filter(item => item.length > 1);
  }

  private ingredientMatches(userIngredient: string, recipeIngredient: string) {
    const user = this.normalizeIngredient(userIngredient);
    const recipe = this.normalizeIngredient(recipeIngredient);

    if (!user || !recipe) return false;
    if (user === recipe) return true;

    const aliases: Record<string, string[]> = {
      biber: ['yeşil biber', 'kırmızı biber', 'kapya biber', 'sivri biber'],
      tavuk: ['tavuk göğsü', 'tavuk but', 'tavuk pirzola'],
      soğan: ['kuru soğan', 'taze soğan'],
      salça: ['domates salçası', 'biber salçası'],
      'kırmızı et': ['dana eti', 'kuzu eti', 'kuşbaşı et'],
    };

    const userAliases = aliases[user] || [];
    const recipeAliases = aliases[recipe] || [];

    return userAliases.includes(recipe) || recipeAliases.includes(user);
  }

  private extractRecipeMeta($: cheerio.CheerioAPI) {
    const fullText = $('body').text().replace(/\s+/g, ' ').trim();

    const prepTime =
      $('span[itemprop="prepTime"]').first().text().trim() ||
      $('.prep-time').first().text().trim() ||
      $('[class*="prep"]').first().text().trim() ||
      fullText.match(/Hazırlama\s*Süresi\s*:?\s*([0-9]+\s*dakika|[0-9]+\s*dk)/i)?.[1] ||
      'Belirtilmedi';

    const cookTime =
      $('span[itemprop="cookTime"]').first().text().trim() ||
      $('.cook-time').first().text().trim() ||
      $('[class*="cook"]').first().text().trim() ||
      fullText.match(/Pişirme\s*Süresi\s*:?\s*([0-9]+\s*dakika|[0-9]+\s*dk)/i)?.[1] ||
      'Belirtilmedi';

    const servingsRaw =
      $('span[itemprop="recipeYield"]').first().text().trim() ||
      $('.yield').first().text().trim() ||
      $('li:contains("Kaç Kişilik")').text().replace(/\s+/g, ' ').trim() ||
      $('span:contains("Kaç Kişilik")').parent().text().replace(/\s+/g, ' ').trim() ||
      fullText.match(/([0-9]+\s*-\s*[0-9]+\s*kişilik)/i)?.[1] ||
      fullText.match(/([0-9]+\s*kişilik)/i)?.[1] ||
      'Belirtilmedi';

    const servings =
      servingsRaw
        .replace(/Kaç Kişilik/i, '')
        .replace(/:/g, '')
        .trim() || 'Belirtilmedi';

    const calories = this.extractCalories($, fullText);

    return {
      prepTime,
      cookTime,
      servings,
      calories,
    };
  }

  private extractCalories($: cheerio.CheerioAPI, fullText = '') {
    const candidates = [
      $('meta[itemprop="calories"]').attr('content'),
      $('[itemprop="calories"]').first().attr('content'),
      $('[itemprop="calories"]').first().text(),
      $('.nutrition-circle-value.calories').first().attr('data-value'),
      $('.nutrition-circle-value.calories').first().text(),
      $('.calories').first().attr('data-value'),
      $('.calories').first().text(),
      fullText.match(/([0-9]+\s*kcal)/i)?.[1],
      fullText.match(/([0-9]+\s*kalori)/i)?.[1],
      fullText.match(/Kalori\s*:?\s*([0-9]+)/i)?.[1],
    ];

    const value = candidates
      .map(candidate => String(candidate || '').replace(/\s+/g, ' ').trim())
      .find(candidate => /^[0-9]+(\s*(kcal|kalori))?$/i.test(candidate));

    if (!value) return 'Belirtilmedi';

    return /kcal|kalori/i.test(value) ? value : `${value} kcal`;
  }

  private normalizeRecipeUrl(rawUrl: string): string | null {
    try {
      let url = rawUrl.trim();

      if (url.startsWith('/')) {
        url = `https://www.nefisyemektarifleri.com${url}`;
      }

      const parsed = new URL(url);
      parsed.hash = '';
      parsed.search = '';
      parsed.protocol = 'https:';

      return parsed.toString().replace(/\/$/, '');
    } catch {
      return null;
    }
  }

  private isValidRecipeLink(link: string): boolean {
    const normalized = this.normalizeRecipeUrl(link);
    if (!normalized) return false;

    const url = new URL(normalized);

    if (url.hostname !== 'www.nefisyemektarifleri.com') {
      return false;
    }

    const blockedParts = [
      '/kategori/',
      '/video/',
      '/videolari/',
      '/defter/',
      '/yazar/',
      '/uye/',
      '/giris',
      '/arama',
      '/page/',
      '/blog/',
      '/kac-kalori',
      '/bugun-ne-pisirsem',
      '/liste/',
      '/pratik-bilgiler',
      '/beslenme',
      '/saglik',
      '/diyet',
      '/ramazan',
    ];

    if (blockedParts.some(part => url.pathname.includes(part))) {
      return false;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length === 1 && parts[0].length > 8;
  }

  private extractRecipeLinksFromHtml(html: string): string[] {
    const $ = cheerio.load(html);
    const links = new Set<string>();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const normalized = this.normalizeRecipeUrl(href);
      if (normalized && this.isValidRecipeLink(normalized)) {
        links.add(normalized);
      }
    });

    return [...links];
  }

  private extractRecipeImage(recipe: any): string | null {
    const image = recipe?.image;

    if (!image) return null;
    if (typeof image === 'string') return image;
    if (Array.isArray(image)) {
      const first = image[0];
      if (typeof first === 'string') return first;
      if (first?.url) return String(first.url);
    }
    if (image?.url) return String(image.url);

    return null;
  }

  private extractInstructions(recipe: any): string {
    const source = recipe?.recipeInstructions;

    if (!source) return '';

    if (typeof source === 'string') {
      return source.trim();
    }

    if (!Array.isArray(source)) {
      return source?.text ? String(source.text).trim() : '';
    }

    return source
      .map((step: any) => {
        if (typeof step === 'string') return step;
        if (step?.text) return step.text;
        if (step?.name) return step.name;
        if (step?.itemListElement) {
          return step.itemListElement
            .map((item: any) => item?.text || item?.name || '')
            .filter(Boolean)
            .join('\n');
        }
        return '';
      })
      .map((text: string) => text.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n\n');
  }

  private extractRecipeFromJsonLd($: cheerio.CheerioAPI): any | null {
    const recipeNodes: any[] = [];

    const collect = (node: any) => {
      if (!node) return;

      if (Array.isArray(node)) {
        node.forEach(collect);
        return;
      }

      if (node['@graph']) {
        collect(node['@graph']);
      }

      const type = node['@type'];
      const types = Array.isArray(type) ? type : [type];

      if (types.includes('Recipe')) {
        recipeNodes.push(node);
      }
    };

    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).text().trim();
      if (!raw) return;

      try {
        collect(JSON.parse(raw));
      } catch {
      }
    });

    const recipe = recipeNodes[0];
    if (!recipe) return null;

    const rawIngredients = Array.isArray(recipe.recipeIngredient)
      ? recipe.recipeIngredient
        .map((x: any) => String(x).trim())
        .filter((item: string) => this.isLikelyIngredientLine(item))
      : [];

    const nutritionCalories = recipe.nutrition?.calories
      ? String(recipe.nutrition.calories).trim()
      : '';

    return {
      name: recipe.name ? String(recipe.name).trim() : '',
      rawIngredients,
      instructions: this.extractInstructions(recipe),
      imageUrl: this.extractRecipeImage(recipe),
      prepTime: this.formatDuration(recipe.prepTime),
      cookTime: this.formatDuration(recipe.cookTime),
      servings: this.formatServings(recipe.recipeYield),
      calories: nutritionCalories
        ? (/kcal|kalori/i.test(nutritionCalories) ? nutritionCalories : `${nutritionCalories} kcal`)
        : 'Belirtilmedi',
    };
  }

  async detectIngredients(files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      return { detectedIngredients: [] };
    }

    const allIngredients = new Set<string>();

    for (const file of files) {
      const formData = new FormData();

      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      let yoloIngredients: string[] = [];

      try {
        console.log("🤖 YOLO'dan tahmin alınıyor...");
        const yoloRes = await lastValueFrom(
          this.httpService.post('http://127.0.0.1:8000/detect', formData, {
            headers: formData.getHeaders(),
            timeout: 8000,
          }),
        );

        if (yoloRes?.data?.ingredients) {
          const translationMap: Record<string, string> = {
            tomato: 'domates',
            potato: 'patates',
            carrot: 'havuç',
            onion: 'soğan',
            garlic: 'sarımsak',
            eggplant: 'patlıcan',
            cucumber: 'salatalık',
            'bell pepper': 'biber',
            'hot pepper': 'biber',
            cabbage: 'lahana',
            broccoli: 'brokoli',
            corn: 'mısır',
            peas: 'bezelye',
            pumpkin: 'balkabağı',
          };

          yoloIngredients = yoloRes.data.ingredients.map((item: string) =>
            this.normalizeIngredient(
              translationMap[item.toLowerCase()] || item.toLowerCase(),
            ),
          );
          console.log("🤖 YOLO'nun Tahmini:", yoloIngredients);
        }
      } catch {
        console.log('⚠️ YOLO sunucusu yanit vermedi, sadece Gemini kullanilacak.');
      }

      const base64Data = file.buffer.toString('base64');
      const mimeType = file.mimetype;
      const yoloText = yoloIngredients.length > 0 ? yoloIngredients.join(', ') : 'hicbir sey';

      const prompt = `Sen uzman bir aşçısın. Fotoğrafta şu malzemeler tahmin edildi: "${yoloText}".
Fotoğrafa bak. Yanlışları sil, doğru malzemeleri ekle.
SADECE temel yemeklik malzemeleri Türkçe olarak virgülle yaz.
Örnek: patlıcan, tavuk, soğan, maydanoz`;

      try {
        console.log("🧠 Gemini'den (Baş Aşçı) teyit isteniyor...");

        const model = this.genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
        });

        const geminiRes = await model.generateContent([
          prompt,
          { inlineData: { data: base64Data, mimeType } },
        ]);

        const finalIngredients = geminiRes.response
          .text()
          .trim()
          .split(',')
          .map(item => this.normalizeIngredient(item))
          .filter(Boolean);

        console.log("🌟 BAŞ AŞÇININ KESİN KARARI:", finalIngredients);
        finalIngredients.forEach(item => allIngredients.add(item));

      } catch (error: any) {
        console.error("❌ GEMINI BAĞLANTI HATASI:", error.message || error);

        yoloIngredients.forEach(item => allIngredients.add(item));
      }
    }

    return { detectedIngredients: [...allIngredients] };
  }

  async matchRecipes(userIngredients: string[]) {
    if (!userIngredients || userIngredients.length === 0) {
      return { recipes: [] };
    }

    const allRecipes = await this.findAll();

    const ignoredIngredients = [
      'su',
      'tuz',
      'karabiber',
      'pul biber',
      'kırmızı toz biber',
      'kekik',
      'kimyon',
      'nane',
      'sarımsak',
      'soğan',
      'sıvı yağ',
      'yağ',
      'zeytinyağı',
      'tereyağı',
      'tereyağ',
      'şeker',
      'kaşar',
      'peynir',
    ];

    const userIngs = [...new Set(
      userIngredients
        .map(i => this.normalizeIngredient(i))
        .filter(i => i && !ignoredIngredients.includes(i))
    )];

    const matchedRecipes = allRecipes
      .map((recipe: any) => {
        const recipeSource =
          Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0
            ? recipe.ingredients
            : recipe.rawIngredients || [];

        const recipeIngs = [...new Set(
          this.buildComparableIngredients(recipeSource)
            .map(i => this.normalizeIngredient(i))
            .filter(i => i && !ignoredIngredients.includes(i))
        )];

        const matchedIngredients = recipeIngs.filter((ing: string) =>
          userIngs.some(userIng => this.ingredientMatches(userIng, ing))
        );

        const missingIngredients = recipeIngs.filter((ing: string) =>
          !userIngs.some(userIng => this.ingredientMatches(userIng, ing))
        );

        const matchScore =
          recipeIngs.length > 0
            ? Math.round((matchedIngredients.length / recipeIngs.length) * 100)
            : 0;

        const recipeName = this.normalizeIngredient(recipe.name || '');

        let priorityScore = 0;

        if (
          recipeName.includes('menemen') &&
          userIngs.includes('yumurta') &&
          (userIngs.includes('domates') || userIngs.includes('biber'))
        ) {
          priorityScore = 1200;
        } else if (
          recipeName.includes('omlet') &&
          userIngs.includes('yumurta') &&
          recipeName.includes('domates') &&
          userIngs.includes('domates')
        ) {
          priorityScore = 1150;
        } else if (
          recipeName.includes('omlet') &&
          userIngs.includes('yumurta') &&
          userIngs.includes('biber')
        ) {
          priorityScore = 1100;
        } else if (
          recipeName.includes('omlet') &&
          userIngs.includes('yumurta')
        ) {
          priorityScore = 1000;
        }

        return {
          ...recipe,
          ingredients: recipeIngs,
          matchCount: matchedIngredients.length,
          missingCount: missingIngredients.length,
          matchScore,
          priorityScore,
          matchedIngredients,
          missingIngredients,
          rating:
            recipe.favoriteCount >= 2
              ? '5.0'
              : recipe.favoriteCount === 1
                ? '4.5'
                : '4.0',
        };
      })
      .filter((recipe: any) => recipe.matchScore >= 70)
      .sort((a: any, b: any) => {
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }

        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }

        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount;
        }

        return a.missingCount - b.missingCount;
      });

    return { recipes: matchedRecipes };
  }

  async scrapeRecipeDetails(url: string): Promise<any> {
    if (!url) {
      return { error: 'URL bulunamadi.' };
    }

    try {
      const html = await this.fetchHtml(url);
      if (!html) {
        return {
          error: 'Siteye su an ulasilamiyor.',
          instructions: 'Tarif detaylari cekilemedi.',
          scrapedIngredients: [],
        };
      }

      const $ = cheerio.load(html);
      const jsonLdRecipe = this.extractRecipeFromJsonLd($);

      const imageUrl =
        jsonLdRecipe?.imageUrl ||
        $('meta[property="og:image"]').attr('content') ||
        $('.recipe-image img').attr('src') ||
        null;

      const scrapedIngredients: string[] = jsonLdRecipe?.rawIngredients || [];

      if (scrapedIngredients.length === 0) {
        $(
          '.recipe-materials li, [itemprop="recipeIngredient"], .ingredients li, .recipe-ingredients li',
        ).each((_, el) => {
          const text = $(el).text().replace(/\s+/g, ' ').trim();

          if (
            this.isLikelyIngredientLine(text) &&
            !scrapedIngredients.includes(text)
          ) {
            scrapedIngredients.push(text);
          }
        });
      }

      let instructions = jsonLdRecipe?.instructions || '';

      if (!instructions) {
        const instructionsArray: string[] = [];

        $(
          'ol.recipe-instructions li, ul.recipe-instructions li, .recipe-instructions li, .recipe-text p, .recipe-text ol li, [itemprop="recipeInstructions"] p',
        ).each((_, el) => {
          const text = $(el)
            .text()
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/Not Ekle/gi, '')
            .trim();

          if (text && text.length > 15 && !instructionsArray.includes(text)) {
            instructionsArray.push(text);
          }
        });

        instructions = instructionsArray.join('\n\n');
      }

      const pageMeta = this.extractRecipeMeta($);
      const meta = {
        prepTime: jsonLdRecipe?.prepTime && jsonLdRecipe.prepTime !== 'Belirtilmedi' ? jsonLdRecipe.prepTime : pageMeta.prepTime,
        cookTime: jsonLdRecipe?.cookTime && jsonLdRecipe.cookTime !== 'Belirtilmedi' ? jsonLdRecipe.cookTime : pageMeta.cookTime,
        servings: jsonLdRecipe?.servings && jsonLdRecipe.servings !== 'Belirtilmedi' ? jsonLdRecipe.servings : pageMeta.servings,
        calories: jsonLdRecipe?.calories && jsonLdRecipe.calories !== 'Belirtilmedi' ? jsonLdRecipe.calories : pageMeta.calories,
      };

      return {
        imageUrl,
        scrapedIngredients,
        ingredients: this.extractBaseIngredients(scrapedIngredients),
        instructions: instructions || 'Tarif adimlari bulunamadi.',
        prepTime: this.formatDuration(meta.prepTime),
        cookTime: this.formatDuration(meta.cookTime),
        servings: this.formatServings(meta.servings),
        calories: meta.calories || 'Belirtilmedi',
      };
    } catch {
      return {
        error: 'Siteye su an ulasilamiyor.',
        instructions: 'Tarif detaylari cekilemedi.',
        scrapedIngredients: [],
      };
    }
  }

  private async collectCategoryLinks(category: string, maxPage = 80): Promise<string[]> {
    const links = new Set<string>();
    let emptyPageCount = 0;

    for (let page = 1; page <= maxPage; page++) {
      const pageUrl =
        page === 1
          ? `https://www.nefisyemektarifleri.com/${category}/`
          : `https://www.nefisyemektarifleri.com/${category}/page/${page}/`;

      const html = await this.fetchHtml(pageUrl);

      if (!html) {
        emptyPageCount++;
        if (emptyPageCount >= 3) break;
        continue;
      }

      const foundLinks = this.extractRecipeLinksFromHtml(html);

      console.log(
        `KATEGORI: ${category} | page=${page} | bulunan=${foundLinks.length}`,
      );

      if (foundLinks.length === 0) {
        emptyPageCount++;
        if (emptyPageCount >= 4) break;
      } else {
        emptyPageCount = 0;
        foundLinks.forEach(link => links.add(link));
      }

      await this.sleep(this.randomDelay());
    }

    return [...links];
  }

  private async collectSitemapLinks(maxLinks = 50): Promise<string[]> {
    const sitemapUrls = [
      'https://www.nefisyemektarifleri.com/sitemap.xml',
      'https://www.nefisyemektarifleri.com/post-sitemap.xml',
    ];

    const checkedSitemaps = new Set<string>();
    const recipeLinks = new Set<string>();
    const queue = [...sitemapUrls];

    while (
      queue.length > 0 &&
      checkedSitemaps.size < 40 &&
      recipeLinks.size < maxLinks
    ) {
      const sitemapUrl = queue.shift()!;
      if (checkedSitemaps.has(sitemapUrl)) continue;

      checkedSitemaps.add(sitemapUrl);

      const xml = await this.fetchHtml(sitemapUrl, 2);
      if (!xml) continue;

      const $ = cheerio.load(xml, { xmlMode: true });

      $('loc').each((_, el) => {
        const loc = $(el).text().trim();
        if (!loc) return;

        if (loc.endsWith('.xml') && !checkedSitemaps.has(loc)) {
          queue.push(loc);
          return;
        }

        const normalized = this.normalizeRecipeUrl(loc);
        if (normalized && this.isValidRecipeLink(normalized)) {
          recipeLinks.add(normalized);
        }
      });

      console.log(
        `SITEMAP: ${sitemapUrl} | toplam tarif linki=${recipeLinks.size}`,
      );

      await this.sleep(this.randomDelay(1000, 2500));
    }

    return [...recipeLinks].slice(0, maxLinks);
  }

  async runNightBot(saveLimit = 5000) {
    console.log(`Bot baslatildi. Hedef: ${saveLimit} tarif`);

    const categories = [
      'kategori/tarifler/kahvaltilik-tarifleri',
    ];

    let savedCount = 0;
    let skippedCount = 0;
    const checkedLinks = new Set<string>();

    const processLinks = async (links: string[], category: string) => {
      for (const link of links) {
        if (checkedLinks.has(link)) continue;

        checkedLinks.add(link);

        const exists = await this.recipesRepository.findOne({
          where: { recipeUrl: link },
        });

        if (exists) {
          skippedCount++;
          continue;
        }

        const saved = await this.scrapeAndSaveForBot(link, category);

        if (saved) {
          savedCount++;
        } else {
          skippedCount++;
        }

        if (savedCount >= saveLimit) {
          return;
        }

        await this.sleep(this.randomDelay());
      }
    };

    const pageLimit = saveLimit <= 5 ? 1 : saveLimit <= 500 ? 5 : 20;

    for (const category of categories) {
      const categoryLinks = await this.collectCategoryLinks(category, pageLimit);
      const categoryLabel = this.getCategoryLabel(category);

      await processLinks(categoryLinks, categoryLabel);

      if (savedCount >= saveLimit) {
        break;
      }
    }

    if (savedCount < saveLimit) {
      const sitemapTarget = Math.min(Math.max(saveLimit * 5, 10), 3000);
      const sitemapLinks = await this.collectSitemapLinks(sitemapTarget);
      await processLinks(sitemapLinks, 'Genel');
    }

    console.log(`Toplam kontrol edilen tarif linki: ${checkedLinks.size}`);

    console.log(
      `Bot tamamlandi. Kaydedilen=${savedCount} | Atlanan=${skippedCount}`,
    );

    return {
      message: 'Bot calismasini bitirdi.',
      savedCount,
      skippedCount,
      targetCount: saveLimit,
      totalFoundLinks: checkedLinks.size,
    };
  }

  private async scrapeAndSaveForBot(
    url: string,
    category = 'Genel',
  ): Promise<boolean> {
    try {
      const html = await this.fetchHtml(url);
      if (!html) {
        console.log(`ATLANDI: HTML alinamadi | ${url}`);
        return false;
      }

      const $ = cheerio.load(html);

      const jsonLdRecipe = this.extractRecipeFromJsonLd($);

      const name =
        jsonLdRecipe?.name ||
        $('h1').first().text().replace(/\s+/g, ' ').trim();

      const imageUrl =
        jsonLdRecipe?.imageUrl ||
        $('meta[property="og:image"]').attr('content') ||
        $('.recipe-image img').attr('src') ||
        null;

      let rawIngredients: string[] = jsonLdRecipe?.rawIngredients || [];

      if (rawIngredients.length === 0) {
        $(
          '.recipe-materials li, [itemprop="recipeIngredient"], .ingredients li, .recipe-ingredients li',
        ).each((_, el) => {
          const text = $(el).text().replace(/\s+/g, ' ').trim();

          if (
            this.isLikelyIngredientLine(text) &&
            !rawIngredients.includes(text)
          ) {
            rawIngredients.push(text);
          }
        });
      }

      const baseIngredients = this.extractBaseIngredients(rawIngredients);
      const pageMeta = this.extractRecipeMeta($);
      const meta = {
        prepTime: jsonLdRecipe?.prepTime && jsonLdRecipe.prepTime !== 'Belirtilmedi' ? jsonLdRecipe.prepTime : pageMeta.prepTime,
        cookTime: jsonLdRecipe?.cookTime && jsonLdRecipe.cookTime !== 'Belirtilmedi' ? jsonLdRecipe.cookTime : pageMeta.cookTime,
        servings: jsonLdRecipe?.servings && jsonLdRecipe.servings !== 'Belirtilmedi' ? jsonLdRecipe.servings : pageMeta.servings,
        calories: jsonLdRecipe?.calories && jsonLdRecipe.calories !== 'Belirtilmedi' ? jsonLdRecipe.calories : pageMeta.calories,
      };
      let instructions = jsonLdRecipe?.instructions || '';

      if (!instructions) {
        const instructionsArray: string[] = [];

        $(
          'ol.recipe-instructions li, ul.recipe-instructions li, .recipe-instructions li, .recipe-text p, .recipe-text ol li, [itemprop="recipeInstructions"] p',
        ).each((_, el) => {
          const text = $(el)
            .text()
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/Not Ekle/gi, '')
            .trim();

          if (text && text.length > 15 && !instructionsArray.includes(text)) {
            instructionsArray.push(text);
          }
        });

        instructions = instructionsArray.join('\n\n');
      }

      if (!name) {
        console.log(`ATLANDI: Baslik yok | ${url}`);
        return false;
      }

      if (baseIngredients.length === 0) {
        console.log(`ATLANDI: Malzeme yok | ${name} | ${url}`);
        return false;
      }

      const inferredCategory = this.inferRecipeCategory(
        name,
        baseIngredients,
        category,
      );

      const newRecipe = this.recipesRepository.create({
        name,
        recipeUrl: url,
        url,
        ingredients: baseIngredients,
        rawIngredients,
        prepTime: this.formatDuration(meta.prepTime),
        cookTime: this.formatDuration(meta.cookTime),
        servings: this.formatServings(meta.servings),
        calories: meta.calories || 'Belirtilmedi',
        imageUrl,
        instructions: instructions || 'Tarif adimlari bulunamadi.',
        category: inferredCategory,
        sourceSite: this.getSourceSite(url),
      } as any);

      await this.recipesRepository.save(newRecipe);

      console.log(
        `KAYDEDILDI: ${name} | Malzeme sayisi=${baseIngredients.length}`,
      );

      return true;
    } catch (error: any) {
      console.log(`BOT KAZIMA HATASI: ${url} | ${error.message}`);
      return false;
    }
  }
}
