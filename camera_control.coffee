EventEmitter = require("events").EventEmitter
spawn = require("child_process").spawn
exec = require("child_process").exec
savingRegex = /Saving file as ([^.jpg]+)/g
capturedPhotoRegex = /Capturing frame/g
camera_control = (filename, cwd, web_root_path, numFrames) ->
  exec "killall PTPCamera"
  filename = "%m-%y-%d_%H:%M:%S-%n.jpg"  if filename is `undefined`
  cwd = "public/photos"  if cwd is `undefined`
  web_root_path = "/photos"  if web_root_path is `undefined`
  port = "usb:253,004"
  camera_name = "Canon EOS 60D"
  emitter = new EventEmitter()
  frames = 4
  delay = 2
  emitter.on "snap", ->
    emitter.emit "camera_begin_snap"
    console.log "snapping..."
    capture = spawn("gphoto2", [ "--capture-image-and-download", "--force-overwrite", "--filename=" + filename, "--camera=#{camera_name}", "--port=#{port}", "--frames=#{frames}", "--interval=#{delay}" ],
      cwd: cwd
    )
    console.log "capture object is " + capture
    capture.stdout.on "data", (data) ->
      console.log 'data>', data.toString()
      if capturedPhotoRegex.exec(data.toString())
        console.log "camera snapped!"
        emitter.emit "camera_snapped"
      saving = savingRegex.exec(data.toString())
      if saving
        fname = saving[1] + ".jpg"
        console.log "saved to " + fname
        emitter.emit "photo_saved", fname, cwd + "/" + fname, web_root_path + "/" + fname
    capture.on 'exit', ->
      emitter.emit 'complete'
      console.log 'gphoto exited'

  emitter

module.exports = camera_control
