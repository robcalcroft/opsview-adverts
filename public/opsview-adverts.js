/* eslint-disable */
var sizes = ['640x960', '500x300', '600x200'];
var s3BaseUrl = 'https://s3.amazonaws.com/';
var s3Bucket = 'opsview-adverts-testing';

var formListener = function() {
  $('#addAdvert').submit(function(event) {
    event.preventDefault();
    var advertLoader = $('addAdvert__loader');

    advertLoader.show();

    $.ajax({
      url: 'api/advert/new',
      data: new FormData($(this)[0]),
      method: 'POST',
      processData: false,
      contentType: false,
    })
    .always(function() {
      advertLoader.hide();
    })
    .done(function() {
      window.location.reload();
    })
    .fail(function(error) {
      swal(
        'Error',
        error.responseJSON.message,
        'error'
      );
    });
  });
}

var templateAdvertCard = function(advert, size) {
  var imageUrl = advert.image_url.split('/');
  return (
    '<div class="card-image">' +
      '<img src="' + advert.image_url + '">' +
    '</div>' +
    '<div class="card-stacked">' +
      '<div class="card-content">' +
        '<p>Advert for ' + size + '</p>' +
      '</div>' +
      '<div class="card-action">' +
        '<a target="_blank" href="' + advert.redirect_url + '">Go to URL</a>' +
        '<a href="#" onClick="deleteButtonListener(\'' + imageUrl[imageUrl.length - 1] + '\');" class="deleteButton">Delete</a>' +
      '</div>' +
    '</div>'
  );
}

var getCurrentAdverts = function() {
  sizes.forEach(function(size) {
    $.getJSON(s3BaseUrl + s3Bucket + '/' + size + '/advert.json?time=' + new Date().getTime())
    .always(function() {
      $('#currentAdverts__loader__' + size).hide();
    })
    .done(function(advert) {
      $('.currentAdverts__' + size).html(templateAdvertCard(advert, size));
    })
    .fail(function(error) {
      var sizeMap = {
        '640x960': 'Usually mobile',
        '500x300': 'Usually a login screen',
        '600x200': 'Usually used for product reload',
      };
      $('.currentAdverts__' + size + ' > .card-content').html('No advert available for ' + size + ' (' + sizeMap[size] + ')');
    });
  });
}

var toggleAdsListener = function() {
  $('button#toggleAds').click(function() {
    var areAdsEnabled = $(this).attr('data-enabled');
    var previousText = $(this).html();
    $(this).html('Loading...');
    $.post('api/status', { enabled: areAdsEnabled === '1' ? 0 : 1 })
    .fail(function(error) {
      swal(
        'Error',
        error.responseJSON.message,
        'error'
      );
    })
    .always(function() {
      $(this).html(previousText);
    }.bind(this))
    .done(function() {
      window.location.reload();
    });
  });
}

var getToggleAdButtonText = function() {
  var button = $('button#toggleAds');
  $.getJSON('api/status')
  .done(function(data) {
    button.html(data.result.enabled ? 'Disable Ads' : 'Enable Ads');
    button.attr('data-enabled', data.result.enabled);
    if (!data.result.enabled) {
      $('#advertOfflineMessage').show();
    }
  })
  .fail(function(error) {
    button.html('Error');
    swal(
      'Error',
      error.responseJSON.message,
      'error'
    );
  });
}

var deleteButtonListener = function(image) {
  $.ajax({
    url: 'api/advert?image_name=' + image,
    method: 'DELETE',
  })
  .done(function() {
    window.location.reload();
  })
  .fail(function(error, response) {
    console.log(error)
    swal(
      'Error',
      error.responseJSON.message,
      'error'
    );
  });
}

var getFutureAdverts = function() {
  $.getJSON('api/advert')
  .always(function() {
    sizes.forEach(function(size) {
      $('#nextAds__loader__' + size).hide();
    });
  })
  .done(function(data) {
    sizes.forEach(function(size) {
      var sizeFilteredResult = data.result.filter(function(advert) {
        return advert.target_size === size;
      });
      $.getJSON(s3BaseUrl + s3Bucket + '/' + size + '/advert.json?time=' + new Date().getTime())
      .done(function(s3Data) {
        var currentImage = s3Data.image_url.split('/');
        currentImage = currentImage[currentImage.length - 1];

        var indexOfCurrentAdvert = sizeFilteredResult.map(function(advert) {
          return advert.image_name;
        }).indexOf(currentImage);

        if (indexOfCurrentAdvert === -1) {
          return $('.nextAds__' + size + ' > .card-content').html('No future advert available for ' + size + '; the current one will stay live until a new one is added');
        }

        var nextAdvertIndex = sizeFilteredResult[indexOfCurrentAdvert + 1] === undefined ? 0 : (indexOfCurrentAdvert + 1);
        var nextAdvert = sizeFilteredResult[nextAdvertIndex];

        $('.nextAds__' + size).html(templateAdvertCard({
          image_url: s3BaseUrl + s3Bucket + '/' + size + '/' + nextAdvert.image_name,
          redirect_url: nextAdvert.redirect_url,
        }, size));
      })
      .fail(function() {
        $('.nextAds__' + size + ' > .card-content').html('No future advert available for ' + size + '; the current one will stay live until a new one is added');
      });
    });
  })
  .fail(function(error) {
    sizes.forEach(function(size) {
      $('.nextAds__' + size + ' > .card-content').html('No future advert available; the current one will stay live until a new one is added');
    });
  });
}

$(function() {
  // Listens to submissions for new adverts
  formListener();
  // Gets the current ads from S3
  getCurrentAdverts();
  // Listens for a click on the toggle ad status button
  toggleAdsListener();
  // Sets the text on the toggle ad status button
  getToggleAdButtonText();
  // Gets all the ads from the database
  getFutureAdverts();
  // Materialize initialisation
  $('select').material_select();
  $('.modal').modal();
});
