import { Injectable } from '@angular/core';
import * as THREE from 'three';
// Correct import path for OBJLoader
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

@Injectable({
  providedIn: 'root'
})
export class ObjLoaderService {
  private objLoader: OBJLoader;

  constructor() {
    this.objLoader = new OBJLoader();
  }

  loadObj(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.objLoader.load(
        url,
        (object) => resolve(object),
        (progress) => console.log('Loading progress:', progress),
        (error) => reject(error)
      );
    });
  }

  loadObjFromFile(file: File): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          try {
            const object = this.objLoader.parse(event.target.result as string);
            resolve(object);
          } catch (error) {
            reject(error);
          }
        }
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  }
}