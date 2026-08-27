<?php
/**
 * APF Contact Form REST endpoint.
 *
 * Add this snippet with the Code Snippets plugin in WordPress, set it to run
 * everywhere, then activate it. Replace the secret below with a long random
 * string and put the identical value in Astro's WP_CONTACT_SECRET environment.
 */

define( 'APF_CONTACT_SECRET', 'replace-with-a-long-random-secret' );
define( 'APF_CONTACT_RECIPIENT', 'yuwanida.c@gofive.co.th' );

add_action( 'rest_api_init', function () {
	register_rest_route( 'apf/v1', '/contact', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'callback'            => 'apf_handle_contact_form',
		'permission_callback' => '__return_true',
	) );
} );

function apf_contact_clean( $value ) {
	return is_string( $value ) ? trim( wp_strip_all_tags( $value ) ) : '';
}

function apf_handle_contact_form( WP_REST_Request $request ) {
	if ( ! hash_equals( APF_CONTACT_SECRET, (string) $request->get_header( 'X-APF-Contact-Key' ) ) ) {
		return new WP_REST_Response( array( 'message' => 'Unauthorized' ), 401 );
	}

	$data      = array_map( 'apf_contact_clean', (array) $request->get_json_params() );
	$form_type = $data['formType'] ?? '';
	$required  = array(
		'inquiry' => array( 'name', 'email', 'phone', 'subject', 'message' ),
		'demo'    => array( 'name', 'email', 'phone', 'date', 'time', 'appointmentType', 'message' ),
	);

	if ( ! isset( $required[ $form_type ] ) || empty( $data['privacy'] ) ) {
		return new WP_REST_Response( array( 'message' => 'Invalid form data' ), 400 );
	}
	foreach ( $required[ $form_type ] as $field ) {
		if ( empty( $data[ $field ] ) ) return new WP_REST_Response( array( 'message' => 'Missing required field' ), 400 );
	}
	if ( ! is_email( $data['email'] ) ) return new WP_REST_Response( array( 'message' => 'Invalid email' ), 400 );

	$type_label = $form_type === 'inquiry' ? 'ติดต่อสอบถาม' : 'นัด Demo ระบบ';
	$subject    = sprintf( '[APF Website] %s - %s', $type_label, $data['name'] ?: $data['company'] );
	$labels     = array(
		'name' => 'ชื่อ-นามสกุล', 'company' => 'บริษัท', 'email' => 'อีเมล', 'phone' => 'เบอร์โทรศัพท์',
		'subject' => 'เรื่อง', 'date' => 'วันที่นัด', 'time' => 'เวลานัด', 'appointmentType' => 'รูปแบบการนัดหมาย', 'message' => 'รายละเอียด',
	);
	$fields = $form_type === 'inquiry'
		? array( 'name', 'company', 'email', 'phone', 'subject', 'message' )
		: array( 'name', 'company', 'email', 'phone', 'date', 'time', 'appointmentType', 'message' );
	$body = array( 'ประเภท: ' . $type_label );
	foreach ( $fields as $field ) $body[] = $labels[ $field ] . ': ' . ( $data[ $field ] ?: '-' );
	$body[] = 'วันที่/เวลาที่ส่ง Form: ' . wp_date( 'j F Y H:i:s', null, wp_timezone() );

	$sent = wp_mail( APF_CONTACT_RECIPIENT, $subject, implode( "\n", $body ), array( 'Reply-To: ' . $data['email'] ) );
	if ( ! $sent ) {
		error_log( 'APF contact form: wp_mail failed.' );
		return new WP_REST_Response( array( 'message' => 'Email delivery failed' ), 500 );
	}
	return new WP_REST_Response( array( 'ok' => true ), 200 );
}
