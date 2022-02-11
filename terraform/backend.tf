terraform {
  backend "s3" {
    bucket = "secure-backend-store"
    key    = "secure/tf.state"
    region = "us-east-1"
    profile = "yntymak"
  }
}
