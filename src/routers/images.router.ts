import { Router } from '@steroids/core';
import express from 'express';
import path from 'path';

@Router({
  name: 'images',
  routes: [
    { path: '/image', handler: 'image' }
  ]
})
export class ImagesRouter {

  public get image() { return express.static(path.resolve(__dirname, '..', 'images')); }

}
