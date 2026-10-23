using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TicketManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageReplies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AuthorId",
                table: "TicketMessages",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Direction",
                table: "TicketMessages",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                // Every existing message is a received customer email.
                defaultValue: "inbound");

            migrationBuilder.CreateIndex(
                name: "IX_TicketMessages_AuthorId",
                table: "TicketMessages",
                column: "AuthorId");

            migrationBuilder.AddForeignKey(
                name: "FK_TicketMessages_Users_AuthorId",
                table: "TicketMessages",
                column: "AuthorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TicketMessages_Users_AuthorId",
                table: "TicketMessages");

            migrationBuilder.DropIndex(
                name: "IX_TicketMessages_AuthorId",
                table: "TicketMessages");

            migrationBuilder.DropColumn(
                name: "AuthorId",
                table: "TicketMessages");

            migrationBuilder.DropColumn(
                name: "Direction",
                table: "TicketMessages");
        }
    }
}
