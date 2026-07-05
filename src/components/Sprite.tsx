import {Dex} from '@pkmn/dex';
import {Sprites} from '@pkmn/img';

interface PokemonSpriteProps {
  name: string;
  className?: string;
}

const staleMegaSpritePattern = /\/sprites\/gen5\/([^/]+)\.png$/;

function getPokemonSprite(name: string): ReturnType<typeof Sprites.getPokemon> {
  const species = Dex.species.get(name);
  const sprite = Sprites.getPokemon(species.exists ? species.name : name);
  const staleMegaSprite = sprite.url.match(staleMegaSpritePattern);

  if (!species.exists || !species.forme.startsWith('Mega') || !staleMegaSprite || staleMegaSprite[1] === '0') {
    return sprite;
  }

  return {
    ...sprite,
    url: sprite.url.replace('/sprites/gen5/', '/sprites/ani/').replace(/\.png$/, '.gif'),
    pixelated: false
  };
}

export function PokemonSprite({name, className = ''}: PokemonSpriteProps) {
  const sprite = getPokemonSprite(name);
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
