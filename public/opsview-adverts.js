/* eslint-disable */
$(function() {
  // Listeners
  $('.add-advert').submit(function(event) {
    event.preventDefault();

    $('#add-advert-loader').show();

    $.ajax({
      url: '/add',
      data: new FormData($(this)[0]),
      method: 'POST',
      processData: false,
      contentType: false,
    })
    .always(function() {
      $('#add-advert-loader').hide();
    })
    .done(function(data) {
      console.log('done', data);
    })
    .fail(function(error) {
      console.log('fail', error)
    });
  });
});
