# amit-secure-cloudfront


### Steps to deploy

1. **Setup aws-cli & terraform-cli in your local**
2. **Make sure aws-cli is properly configured with AWS Credentials**
3. **Build edge-lambdas code**
   
   ```bash
   cd ./edge-lambdas

   npm install

   npm run build

   ```
4. **Check if terraform is valid**
   ```bash
   cd ./terraform
   
   terraform plan
   ```
5. **Deploy terraform**
   ```bash
   terraform apply
   ```
6. **Destroy infrastructure if required**
   ```bash
   terraform destroy
   ```