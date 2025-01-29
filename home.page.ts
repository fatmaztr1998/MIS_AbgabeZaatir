import { Component } from '@angular/core';
import { NavController, AlertController } from '@ionic/angular'; // Import AlertController
import { Storage } from '@ionic/storage-angular';
import { v4 as uuidv4 } from 'uuid';
import { ImageService } from '../service/image.service';
import { ActionSheetController } from '@ionic/angular';
import * as exifr from 'exifr';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  imageList: Array<{ id: string; url: string; title: string; date: string; location: { lat: number; lng: number } }> =
    [];
  showAddImageForm: boolean = false; // Toggle for the add image form
  newImageTitle: string = ''; // Title input
  selectedImage: string | null = null; // Selected image preview
  private _storage: Storage | null = null;
  imageLocation: { lat: number; lng: number } | null = null;

  constructor(
    private navCtrl: NavController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController, 
    private storage: Storage,
    private imageService: ImageService
  ) {}

  async ngOnInit() {
    // Initialize storage
    this._storage = await this.storage.create();
    const savedImages = (await this._storage.get('imageList')) || [];
    this.imageList = savedImages;
    

    // Sync with shared service
    this.imageService.setImageList(this.imageList);
    this.imageService.imageList$.subscribe((updatedList) => {
      this.imageList = updatedList;
      this._storage?.set('imageList', updatedList);
    });
  }

  toggleAddImageForm() {
    this.showAddImageForm = !this.showAddImageForm;
    if (!this.showAddImageForm) {
      // Reset inputs when closing the form
      this.newImageTitle = '';
      this.selectedImage = null;
    }
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement)?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        this.selectedImage = reader.result as string;
  
        // Extract GPS coordinates from the image's EXIF metadata
        const metadata = await exifr.gps(file);
        if (metadata && metadata.latitude && metadata.longitude) {
          this.imageLocation = { lat: metadata.latitude, lng: metadata.longitude }; // Use extracted location
        } else {
          this.imageLocation = { lat: 51.505, lng: -0.09 }; // Fallback to default location
        }
      };
      reader.readAsDataURL(file);
    }
  }

  async addImage() {
    if (!this.newImageTitle || !this.selectedImage) {
      console.error('Title and image are required.');
      return;
    }
  
    const currentDate = new Date().toISOString().split('T')[0];
    const location = this.imageLocation || { lat: 51.505, lng: -0.09 }; // Use extracted or default location
  
    const newImage = {
      id: uuidv4(),
      title: this.newImageTitle,
      url: this.selectedImage,
      date: currentDate,
      location, // Save the location
    };
  
    this.imageList.push(newImage);
    this.imageService.setImageList(this.imageList); // Update shared service
    this._storage?.set('imageList', this.imageList); // Save to storage
  
    // Reset form and hide it
    this.toggleAddImageForm();
  }

  openImageDetail(image: any) {
    this.navCtrl.navigateForward('/image-detail', {
      state: { image },
    });
  }

  async editImageTitle(imageId: string) {
    const imageToEdit = this.imageList.find((image) => image.id === imageId);

    if (!imageToEdit) {
      console.error('Image not found.');
      return;
    }

    const newTitle = prompt('Enter a new title:', imageToEdit.title);
    if (newTitle && newTitle.trim() !== '') {
      imageToEdit.title = newTitle;
      this.imageService.setImageList(this.imageList);
      this._storage?.set('imageList', this.imageList);
    } else {
      console.error('Invalid title.');
    }
  }

  async deleteImage(imageId: string) {
    const imageToDelete = this.imageList.find((image) => image.id === imageId);

    if (!imageToDelete) {
      console.error('Image not found.');
      return;
    }

    // Show confirmation dialog before deleting
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${imageToDelete.title}"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel', // No action on cancel
        },
        {
          text: 'Delete',
          handler: async () => {
            // Perform the deletion
            this.imageList = this.imageList.filter((image) => image.id !== imageId);
            this.imageService.setImageList(this.imageList);
            await this._storage?.set('imageList', this.imageList);
            console.log(`Image "${imageToDelete.title}" deleted.`);
          },
        },
      ],
    });

    await alert.present();
  }

  async presentActionSheet(imageId: string) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Options',
      buttons: [
        {
          text: 'Edit',
          icon: 'create',
          handler: () => {
            this.editImageTitle(imageId);
          },
        },
        {
          text: 'Delete',
          icon: 'trash',
          role: 'destructive',
          handler: () => {
            this.deleteImage(imageId);
          },
        },
        {
          text: 'Cancel',
          icon: 'close',
          role: 'cancel',
        },
      ],
    });
  
    await actionSheet.present();
  }
}