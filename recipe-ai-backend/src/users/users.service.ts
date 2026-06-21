import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Recipe)
    private recipesRepository: Repository<Recipe>,
  ) {}

  async register(userData: any): Promise<User> {
    const existingUser = await this.usersRepository.findOne({ where: { email: userData.email } });
    if (existingUser) {
      throw new BadRequestException('Bu e-posta adresi zaten kullanımda!');
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    const newUser = this.usersRepository.create({
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      phone: userData.phone,
    });
    return this.usersRepository.save(newUser);
  }

  async login(loginData: any) {
    const user = await this.usersRepository.findOne({ where: { email: loginData.email } });
    if (!user) {
      throw new NotFoundException('Bu e-posta adresine ait bir hesap bulunamadı.');
    }
    const isPasswordValid = await bcrypt.compare(loginData.password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Hatalı şifre girdiniz.');
    }
    const { password, ...result } = user;
    return result;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email }, relations: { favoriteRecipes: true } });
  }

  async toggleFavorite(userId: number, recipeId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId }, relations: { favoriteRecipes: true } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    const recipe = await this.recipesRepository.findOne({ where: { id: recipeId } });
    if (!recipe) throw new NotFoundException('Tarif bulunamadı.');

    const isFavorite = user.favoriteRecipes.some(r => r.id === recipe.id);
    if (isFavorite) {
      user.favoriteRecipes = user.favoriteRecipes.filter(r => r.id !== recipe.id);
    } else {
      user.favoriteRecipes.push(recipe);
    }
    await this.usersRepository.save(user);
    return { message: isFavorite ? "Favorilerden çıkarıldı." : "Favorilere eklendi.", isFavorite: !isFavorite };
  }

  async checkFavoriteStatus(userId: number, recipeId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId }, relations: { favoriteRecipes: true } });
    if (!user) return { isFavorite: false };
    const isFavorite = user.favoriteRecipes.some(r => r.id === recipeId);
    return { isFavorite };
  }

  async getFavorites(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId }, relations: { favoriteRecipes: true } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    return user.favoriteRecipes;
  }

  async findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async updateProfile(userId: number, updateData: any) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (updateData.name) user.name = updateData.name;
    if (updateData.email) user.email = updateData.email;
    if (updateData.profileImage) user.profileImage = updateData.profileImage;
    if (updateData.phone) user.phone = updateData.phone;
    if (updateData.password && updateData.password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(updateData.password, salt);
    }
    const updatedUser = await this.usersRepository.save(user);
    const { password, ...result } = updatedUser;
    return result;
  }
}
