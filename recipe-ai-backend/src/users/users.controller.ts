import { Controller, Post, Get, Put, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() userData: any) {
    const user: User = await this.usersService.register(userData);
    const { password, ...result } = user;
    return { message: "Kayıt işlemi başarıyla tamamlandı!", user: result };
  }

  @Post('login')
  login(@Body() loginData: any) {
    return this.usersService.login(loginData);
  }

  @Post(':userId/favorites/:recipeId')
  toggleFavorite(@Param('userId') userId: string, @Param('recipeId') recipeId: string) {
    return this.usersService.toggleFavorite(+userId, +recipeId);
  }

  @Get(':userId/favorites/:recipeId/check')
  checkFavoriteStatus(@Param('userId') userId: string, @Param('recipeId') recipeId: string) {
    return this.usersService.checkFavoriteStatus(+userId, +recipeId);
  }

  @Get(':userId/favorites')
  getFavorites(@Param('userId') userId: string) {
    return this.usersService.getFavorites(+userId);
  }

  @Get(':id')
  async getUserProfile(@Param('id') id: string) {
    const user = await this.usersService.findOne(+id);
    if (!user) return { error: "Kullanıcı bulunamadı" };
    const { password, ...result } = user;
    return result; 
  }

  @Put(':id')
  updateProfile(@Param('id') id: string, @Body() updateData: any) {
    return this.usersService.updateProfile(+id, updateData);
  }
}