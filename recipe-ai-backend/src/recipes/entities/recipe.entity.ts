import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('recipes')
export class Recipe {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column('text', { array: true })
  ingredients!: string[];

  @Column('text', { array: true, nullable: true })
  rawIngredients!: string[];

  @Column()
  recipeUrl!: string;

  @Column({ nullable: true })
  url!: string;

  @Column({ nullable: true })
  prepTime!: string;

  @Column({ nullable: true })
  cookTime!: string;

  @Column({ nullable: true })
  servings!: string;

  @Column({ nullable: true })
  calories!: string;

  @Column({ nullable: true })
  imageUrl!: string;

  @Column('text', { nullable: true })
  instructions!: string;

  @Column({ nullable: true })
  category!: string;

  @Column({ nullable: true })
  sourceSite!: string;

  @ManyToMany(() => User, (user) => user.favoriteRecipes)
  favoritedBy!: User[];
}
