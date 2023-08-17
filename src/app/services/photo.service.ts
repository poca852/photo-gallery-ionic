import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Platform } from "@ionic/angular";
import { UserPhoto } from '../interfaces/user-photo.interface';
import { Capacitor } from '@capacitor/core';


@Injectable({
  providedIn: 'root'
})
export class PhotoService {

  public photos: UserPhoto[] = [];

  private PHOTO_STORAGE: string = "photos";

  private platform: Platform;

  constructor(
    platform: Platform
  ) { 
    this.platform = platform
  }

  public async addNewToGallery() {
    // Take a photo
    const capturePhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });

    const savedImageFile = await this.savePicture(capturePhoto);
    
    this.photos.unshift(savedImageFile);

    Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    })
  }

  public async loadSaved() {
    // retrieve cached photo array data
    const { value } = await Preferences.get({key: this.PHOTO_STORAGE});
    this.photos = (value ? JSON.parse(value) : []) as UserPhoto[];

    // easiest way to detect when running on the web:
    // "when the platform is Not hybrid, do this"
    if(!this.platform.is("hybrid")){
       // display the photo by reading into base64 format
      for(let photo of this.photos) {
        // read each saved phot´s data from the filesystem
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: Directory.Data
        })
        // web platform only: Load the photos as base64 data;
        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`
      }
    }

    
  }

  public async deletePicture(photo: UserPhoto, position: number){
    // remove this photo from the photos reference data array
    this.photos.splice(position, 1);

    // update photos array cache by overwriting the existing photo array
    Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    })

    // delete photo file from filesystem
    const fileName = photo.filepath
      .substr(photo.filepath.lastIndexOf("/") + 1);

    await Filesystem.deleteFile({
      path: fileName,
      directory: Directory.Data
    })
  }

  private async savePicture(photo: Photo){
    // convert photo to base64 format, required by filesystem api to save
    const base64Date = await this.readAsBase64(photo);

    // write the file to the data directory
    const fileName = Date.now() + "jpeg";
    const saveFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Date,
      directory: Directory.Data
    })

    if(this.platform.is("hybrid")){
      // display the new image by rewriting the "file://" path to http
      // details: https://ionicFramework.com/docs/building/webview#file-protocol
      return {
        filepath: saveFile.uri,
        webviewPath: Capacitor.convertFileSrc(saveFile.uri)
      }
    } else {
      // use webPath to display the new image instead of base64 since it´s 
      // already loaded into memory
      return {
        filepath: fileName,
        webviewPath: photo.webPath
      }
    }

  }

  private async readAsBase64(photo: Photo) {
    // hybrid will detect Cordoba or Capacitor
    if(this.platform.is("hybrid")){
      // read the file into base64 format
      const file = await Filesystem.readFile({
        path: photo.path!
      })

      return file.data;
    } else {
      // fetch the photo, read as a blob, then convert to base64 format
      const response = await fetch(photo.webPath!);
      const blob = await response.blob();
      return await this.convertBlobToBase64(blob) as string;
    }


  }

  private convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;

    reader.onload = () => {
      resolve(reader.result);
    }
    reader.readAsDataURL(blob);
  })
}
