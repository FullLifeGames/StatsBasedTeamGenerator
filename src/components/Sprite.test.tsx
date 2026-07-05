import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {PokemonSprite} from './Sprite';

describe('PokemonSprite', () => {
  it('renders an accessible Pokemon sprite image', () => {
    render(<PokemonSprite name="Great Tusk" />);

    const sprite = screen.getByRole('img', {name: 'Great Tusk sprite'});
    expect(sprite).toHaveAttribute('src');
  });

  it('uses animated Showdown sprites for new Mega forms without packaged animation metadata', () => {
    render(<PokemonSprite name="Floette-Mega" />);

    const sprite = screen.getByRole('img', {name: 'Floette-Mega sprite'});
    expect(sprite).toHaveAttribute(
      'src',
      'https://play.pokemonshowdown.com/sprites/ani/floette-mega.gif'
    );
    expect(sprite).not.toHaveClass('pokemon-sprite--pixelated');
  });

  it('normalizes prefix Mega form names before resolving sprite URLs', () => {
    render(<PokemonSprite name="Mega-Floette" />);

    const sprite = screen.getByRole('img', {name: 'Mega-Floette sprite'});
    expect(sprite).toHaveAttribute(
      'src',
      'https://play.pokemonshowdown.com/sprites/ani/floette-mega.gif'
    );
  });
});
