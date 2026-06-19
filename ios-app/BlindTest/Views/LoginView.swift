import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            HStack(spacing: 0) {
                Text("Blind").font(.system(size: 48, weight: .black)).foregroundColor(.indigo)
                Text("Test").font(.system(size: 48, weight: .black)).foregroundColor(.primary)
            }

            Text("Guess the song, challenge your friends")
                .font(.subheadline).foregroundColor(.secondary).multilineTextAlignment(.center)

            Spacer()

            Button {
                Task { await authVM.login() }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "person.fill")
                    Text("Sign in with Discord").fontWeight(.bold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color(red: 0.345, green: 0.4, blue: 0.95))
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .padding(.horizontal, 32)

            if authVM.isLoading { ProgressView() }

            Spacer()
        }
    }
}
