import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { Recipe } from '../../recipes/entities/recipe.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true }) 
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column('text', { nullable: true })
  profileImage!: string;

  @ManyToMany(() => Recipe)
  @JoinTable()
  favorites!: Recipe[];

  @Column({ nullable: true })
  phone!: string;

  @ManyToMany(() => Recipe, (recipe) => recipe.favoritedBy)
  @JoinTable({ name: 'user_favorites' }) 
  favoriteRecipes!: Recipe[];
}
