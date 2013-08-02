var Shmile = {
  PHOTO_MARGIN: 50, // Margin for the composite photo per side
  WINDOW_WIDTH: $(window).width(),
  WINDOW_HEIGHT: $(window).height() - 10,
  OVERLAY_DELAY: 2000,
  NEXT_DELAY: 15000,
  CHEESE_DELAY: 1000,
  FLASH_DURATION: 1500,
  READY_DELAY: 2000,
  NICE_DELAY: 5000
}

// Current app state
var State = {
  photoset: [],
  set_id: null,
  current_frame_idx: 0,
  zoomed: null
};

$(window).ready(function () {
  // init code
  startButton = $('button#start-button');
  var buttonX = (Shmile.WINDOW_WIDTH - startButton.outerWidth())/2;
  var buttonY = (Shmile.WINDOW_HEIGHT - startButton.outerHeight())/2;

  startButton.hide();

  // Position the start button in the center
  startButton.css({'top': buttonY, 'left': buttonX});

  // Click handler for the start button.
  $('body').click(function(e) {
      startButton.fadeOut(1000);
      $(document).trigger('ui_button_pressed');
  });

  p = new PhotoView();
  p.render();
});

/*****************************************************************************/

// Set up the socket
var socket = io.connect('/')

socket.on('message', function(data) {
  console.log('data is' + data);
});

socket.on('connect', function() {
  console.log('connected evt');
  fsm.connected();
});

$(document).bind('ui_button_pressed', function() {
  console.log('ui_button_pressed evt');
  fsm.ui_button_pressed();
});

socket.on('camera_snapped', function() {
  console.log('camera_snapped evt');
  p.flashEffect(Shmile.FLASH_DURATION);
  //fsm.camera_snapped();
})

socket.on('photo_saved', function(data) {
  console.log('photo_saved evt: '+data.filename);
  console.log(data.web_url)
  p.preloadPhoto(data.web_url)
  State.photos.push( data.web_url)
});

socket.on('complete', function(data) {
  fsm.photos_complete(data);
});

/*
 * STATE MACHINE DEFINITION
 * Keep track of app state and logic.
 *
 * + loading
 *   - connected() -> ready
 * + ready
 *   - ui_button_pressed() (DOM button click) -> waiting_for_photo
 * + waiting_for_photo
 *   - photo_saved() -> review_photo
 * + review_photo
 *   - photo_updated() -> next_photo
 * + next_photo
 *   - continue_partial_set() -> waiting_for_photo
 *   - finish_set() -> ready
 */
var fsm = StateMachine.create({
  initial: 'loading',
  events: [
    { name: 'connected', from: 'loading', to: 'ready' },
    { name: 'ui_button_pressed', from: 'ready', to: 'taking_pictures' },
    { name: 'photo_saved', from: 'taking_pictures', to: 'taking_pictures' },
    { name: 'photo_updated', from: 'taking_pictures', to: 'taking_pictures' },
    { name: 'continue_partial_set', from: 'next_photo', to: 'waiting_for_photo' },
    { name: 'photos_complete', from: 'taking_pictures', to: 'review_composited' },
    { name: 'finish_set', from: 'next_photo', to: 'review_composited' },
    { name: 'next_set', from: 'review_composited', to: 'ready'}
  ],
  callbacks: {
    onconnected: function() {
      p.animate('in', function() {
        startButton.fadeIn();
      });
    },
    onenterready: function() {
      p.resetState();
    },
    onentertaking_pictures: function() {
      console.log('taking pictures')
      var randomId = Math.ceil(Math.random()*100000);
      State.photos = []
      socket.emit('snap', true);
    },
    onenterwaiting_for_photo: function(e) {
    },
    onphoto_saved: function(e, f, t, data) {
      // update UI
      // By the time we get here, the idx has already been updated!!
      console.log('saved');
      p.updatePhotoSet(data.web_url, State.current_frame_idx, function() {
        fsm.photo_updated();
      });
    },
    onphoto_updated: function(e, f, t) {
      // We're done with the full set.
      console.log('photo updated')
      if (State.current_frame_idx == 3) {
        fsm.finish_set();
      }
      // Move the frame index up to the next frame to update.
      else {
        State.current_frame_idx = (State.current_frame_idx + 1) % 4
        fsm.continue_partial_set();
      }
    },
    onenterreview_composited: function(e, f, t, data) {
      socket.emit('composite');
      p.showOverlay(true);
      p.setPhotoset(data.urls)
      setTimeout(function() { fsm.next_set() }, Shmile.NEXT_DELAY);
    },
    onleavereview_composited: function(e, f, t) {
      // Clean up
      p.animate('out');
      p.slideInNext();
    },
    onchangestate: function(e, f, t) {
      console.log('fsm received event '+e+', changing state from ' + f + ' to ' + t)
    }
  }
});