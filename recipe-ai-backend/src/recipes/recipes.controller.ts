import { Controller, Post, Get, Body, UploadedFiles, UseInterceptors, HttpException, HttpStatus, Query } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { RecipesService } from './recipes.service';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) { }

  @Get()
  async findAll() {
    return this.recipesService.findAll();
  }

  @Get('run-bot')
  startNightBot(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit);
    const saveLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 5000;

    this.recipesService.runNightBot(saveLimit);
    return {
      status: "Başarılı",
      message: `Gece Botu arka planda çalışmaya başladı. Hedef: ${saveLimit} tarif.`
    };
  }

  @Post('scrape')
  async scrapeRecipeDetails(@Body('url') url: string) {
    if (!url) {
      throw new HttpException('URL parametresi eksik!', HttpStatus.BAD_REQUEST);
    }
    return this.recipesService.scrapeRecipeDetails(url);
  }

  @Post()
  async create(@Body() createRecipeDto: any) {
    return this.recipesService.create(createRecipeDto);
  }

  @Post('detect')
  @UseInterceptors(FilesInterceptor('files'))
  async detectIngredients(@UploadedFiles() files: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new HttpException('Lütfen bir fotoğraf yükleyin.', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.recipesService.detectIngredients(files);
    } catch (error: any) {
      throw new HttpException(error.message || 'Görüntü işleme hatası.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('match')
  async matchRecipes(@Body('ingredients') ingredients: string[]) {
    if (!ingredients || ingredients.length === 0) {
      throw new HttpException('Lütfen malzeme listesi gönderin.', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.recipesService.matchRecipes(ingredients);
    } catch (error: any) {
      throw new HttpException(error.message || 'Tarifler eşleştirilirken hata oluştu.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
