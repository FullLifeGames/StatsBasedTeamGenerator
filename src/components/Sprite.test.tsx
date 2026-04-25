import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {PokemonSprite} from './Sprite';

describe('PokemonSprite', () => {
  it('renders an accessible Pokemon sprite image', () => {
    render(<PokemonSprite name="Great Tusk" />);

    const sprite = screen.getByRole('img', {name: 'Great Tusk sprite'});
    expect(sprite).toHaveAttribute('src');
  });
});
