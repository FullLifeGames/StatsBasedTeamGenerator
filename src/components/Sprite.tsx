import {Sprites} from '@pkmn/img';

interface PokemonSpriteProps {
  name: string;
  className?: string;
}

export function PokemonSprite({name, className = ''}: PokemonSpriteProps) {
  const sprite = Sprites.getPokemon(name);
  const classes = ['pokemon-sprite', sprite.pixelated ? 'pokemon-sprite--pixelated' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <img
      alt={`${name} sprite`}
      className={classes}
      height={sprite.h}
      loading="lazy"
      src={sprite.url}
      width={sprite.w}
    />
  );
}
